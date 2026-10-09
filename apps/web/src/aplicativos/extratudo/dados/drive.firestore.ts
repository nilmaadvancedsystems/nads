// O Drive do escritório pelo app Pendências (projeto Entregas, entregas-2e5e2). Liberado pelo Vitor
// em 2026-09-29, só para o Creditor puxar o relatório de liquidação da competência:
//   - login com o usuário do Entregas (Firebase Auth, e-mail/senha, o mesmo das Pendências);
//   - driveIndice/raiz e driveIndice/{pasta}/partes/{n}: SÓ LEITURA, o mapa das pastas que o robô
//     mantém (as regras do Entregas só deixam ler quem é admin ou do contábil);
//   - aberturasDrive: o pedido para o robô trazer a cópia do arquivo (modo "baixar"). O robô responde
//     no próprio pedido com um link temporário (30 min) do armazenamento do Entregas, e o arquivo é
//     baixado daquele link (o ÚNICO fetch do nads, travado em scripts/conexoes.mjs).
// Nada aqui grava no Drive. Liberado pelo Vitor em 2026-09-30 ("Pedir extratos", o sistema envia o e-mail
// que puxa do cadastro): clientes (SÓ LEITURA: e-mails e telefone, pelo código do ERP) e solicitacoesEmail
// (o pedido de e-mail tipo 'um' para a fila do robô do Entregas, que monta o HTML e envia pelo Gmail do
// escritório, só para e-mail do cadastro, no máximo 60 por hora). Nenhuma outra coleção do Entregas.
// Acoplado no Entregas (Contábil → Extratudo, 2026-09-29): a pessoa já está logada lá, então não pede
// usuário e senha — os mesmos pedidos (mapa das pastas e pedido ao robô) vão por mensagem para a
// página do Entregas (nilma-ponte-extratudo.js), que responde com o login dela. O download continua
// daqui, do mesmo link do robô.
// E os extratos que chegam por e-mail (liberado pelo Vitor em 08/10/2026, "ele já jogue o extrato para o nads"):
// extratosRecebidos (o robô do Gmail grava; aqui só ler a lista do cliente e mês, ler os pedaços do arquivo e marcar
// importado/ignorado). Nenhuma outra coleção nova.
// E o extrato importado do computador que não está no Drive (Vitor, 09/10/2026: "upe no drive o que ele upou do pc"):
// enviosSecretario (+ partes), a mesma fila da Tarefas › Drive — o robô grava em Claudio Secretario/<mês>/<cliente> e o
// arquivamento leva para EXTRATOS/AAAA/MM/BANCÁRIOS/<BANCO>. O nads nunca escreve direto no Drive.
import { creditor as cr, entregas, extrator as ex } from '@nads/core';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from 'firebase/auth';
import { addDoc as addDocBruto, Bytes, collection, doc, getDoc, getDocs, getFirestore, limit, onSnapshot, query, serverTimestamp, setDoc as setDocBruto, updateDoc as updateDocBruto, where } from 'firebase/firestore';
import { guardar, guardarPedido } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;

/** Configuração web pública do projeto do Entregas (a mesma do app Pendências). */
const CONFIG_ENTREGAS = {
  apiKey: 'AIzaSyD6xg7XhX8dKTKmaYup4hRX5k9XFHEkb98',
  authDomain: 'entregas-2e5e2.firebaseapp.com',
  projectId: 'entregas-2e5e2',
  storageBucket: 'entregas-2e5e2.firebasestorage.app',
  messagingSenderId: '1009094556836',
  appId: '1:1009094556836:web:d3b6a9283e934db064fa31',
};

/** O único endereço de onde o nads baixa arquivo: a cópia temporária que o robô do Entregas publica. */
const LINK_DO_ROBO = 'https://firebasestorage.googleapis.com/v0/b/entregas-2e5e2';
const ESPERA_DO_ROBO_MS = 90000;
/** Quanto espera o robô enviar o e-mail; depois disso o pedido segue na fila e o robô envia quando puder. */
const ESPERA_DO_EMAIL_MS = 60000;

const semPermissao = (e: unknown) => /permission|insufficient/i.test(String((e as Error)?.message || e));

/** O Entregas publicado, a única página de fora que pode responder pelo Drive. */
const ENTREGAS = 'https://nilmaadvancedsystems.github.io';

/** Está dentro do Entregas (iframe)? Pelo endereço de quem está por fora. */
function dentroDoEntregas(): boolean {
  if (window.parent === window) return false;
  let origem = window.location.ancestorOrigins?.[0] || '';
  if (!origem) { try { origem = document.referrer ? new URL(document.referrer).origin : ''; } catch { origem = ''; } }
  return origem === ENTREGAS;
}

async function baixarDoRobo(url: string, passo?: (texto: string) => void): Promise<ArrayBuffer> {
  if (!url.startsWith(LINK_DO_ROBO)) throw new Error('O robô respondeu com um endereço inesperado.');
  passo?.('baixando a cópia');
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.arrayBuffer();
  } catch (e) {
    throw new Error('Não consegui baixar a cópia do Drive (' + ((e as Error)?.message || e) + '). Se o erro for de CORS, o armazenamento do Entregas precisa liberar este site.', { cause: e });
  }
}

/** O Drive pelo login do Entregas que está por fora (sem pedir senha aqui). */
function criarDrivePeloEntregas(): cr.RepoDrive {
  let acesso: cr.AcessoDrive = { pronto: false, entrou: false, quem: '' };
  let ver = 0;
  let proximo = 1;
  const ouvintes = new Set<() => void>();
  const esperando = new Map<number, { ok: (v: unknown) => void; falha: (e: Error) => void; passo?: (t: string) => void }>();

  window.addEventListener('message', e => {
    if (e.origin !== ENTREGAS || e.source !== window.parent) return;
    const m = e.data as { nilmaDrive?: number; id?: number; ok?: boolean; dados?: unknown; passo?: string } | null;
    if (!m || m.nilmaDrive !== 1 || typeof m.id !== 'number') return;
    const w = esperando.get(m.id);
    if (!w) return;
    if (typeof m.passo === 'string') { w.passo?.(m.passo); return; }
    esperando.delete(m.id);
    if (m.ok) w.ok(m.dados); else w.falha(new Error(String(m.dados || 'O Entregas não respondeu.')));
  });

  function pedir<T>(op: string, extra: Record<string, unknown> = {}, passo?: (t: string) => void, espera = 120000): Promise<T> {
    const id = proximo++;
    return new Promise<T>((ok, falha) => {
      const fim = setTimeout(() => { esperando.delete(id); falha(new Error('O Entregas não respondeu. Recarregue a página.')); }, espera);
      esperando.set(id, { ok: v => { clearTimeout(fim); ok(v as T); }, falha: e => { clearTimeout(fim); falha(e); }, passo });
      window.parent.postMessage({ nilmaDrive: 1, id, op, ...extra }, ENTREGAS);
    });
  }

  const avisar = () => { ver++; for (const f of ouvintes) f(); };
  pedir<{ email: string } | null>('quem', {}, undefined, 15000)
    .then(u => { acesso = { pronto: true, entrou: !!u, quem: u?.email ? u.email.replace(/@nilma\.local$/, '') : '' }; })
    .catch(() => { acesso = { pronto: true, entrou: false, quem: '' }; })
    .finally(avisar);

  return {
    exemplos: false,
    loginDeFora: true,
    acesso: () => acesso,
    async entrar() { throw new Error('Entre no Entregas: o Extratudo usa o mesmo login.'); },
    async entrarComGoogle() { throw new Error('Entre no Entregas: o Extratudo usa o mesmo login.'); },
    async sair() { /* o login é o do Entregas */ },
    async pastaDoCliente(codigo) {
      const clientes = await pedir<cr.PastaDoCliente[]>('raiz');
      const pasta = cr.pastaDoCliente(clientes || [], codigo);
      if (!pasta) return null;
      const itens = await pedir<cr.ItemDrive[]>('partes', { pasta: pasta.id });
      return { raiz: pasta.id, nome: pasta.nomePasta, itens: itens || [] };
    },
    async balanceteDoEntregas(codigo) {
      const b = await pedir<{ contas: unknown[]; em: string } | null>('balancete', { codigo: String(codigo) });
      if (!b) return null;
      const lido = cr.balanceteDoDocumento({ contas: b.contas, balanceteAssinaturaTs: b.em });
      return lido.origem === 'nenhum' ? null : lido;
    },
    async baixar(id, nome, passo) {
      const url = await pedir<string>('baixar', { fileId: id, nome }, passo, ESPERA_DO_ROBO_MS + 10000);
      return baixarDoRobo(String(url), passo);
    },
    /** o link temporário do robô (o mesmo pedido "baixar"), só para ver — não guardar */
    async link(id, nome, passo) {
      const url = String(await pedir<string>('baixar', { fileId: id, nome }, passo, ESPERA_DO_ROBO_MS + 10000));
      if (!url.startsWith(LINK_DO_ROBO)) throw new Error('O robô respondeu com um endereço inesperado.');
      return url;
    },
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
  };
}

/** O app do Entregas nesta página (o mesmo do login; o Cadastro, em cadastro.firestore.ts, usa ele também). */
export function appDoEntregas() {
  return getApps().find(a => a.name === 'entregas') ?? initializeApp(CONFIG_ENTREGAS, 'entregas');
}

export function criarDriveFirestore(): cr.RepoDrive {
  if (dentroDoEntregas()) return criarDrivePeloEntregas();
  const app = appDoEntregas();
  const auth = getAuth(app);
  const db = getFirestore(app);
  let acesso: cr.AcessoDrive = { pronto: false, entrou: false, quem: '' };
  let ver = 0;
  const ouvintes = new Set<() => void>();

  onAuthStateChanged(auth, u => {
    acesso = { pronto: true, entrou: !!u, quem: u?.email ? u.email.replace(/@nilma\.local$/, '') : '' };
    ver++;
    for (const f of ouvintes) f();
  });

  return {
    exemplos: false,
    acesso: () => acesso,
    /**
     * A conta Google do escritório, pela janela do Google. O login fica guardado neste navegador (uma vez por
     * computador). Para ler e pedir, a conta precisa estar em usuarios/{uid} no Entregas, com o papel do contábil.
     */
    async entrarComGoogle() {
      let u;
      try {
        const provedor = new GoogleAuthProvider();
        provedor.setCustomParameters({ login_hint: cr.CONTA_GOOGLE_DO_ESCRITORIO, prompt: 'select_account' });
        u = (await signInWithPopup(auth, provedor)).user;
      } catch (e) {
        throw new Error(cr.mensagemDoLoginGoogle(String((e as { code?: string })?.code || (e as Error)?.message || e), window.location.host), { cause: e });
      }
      let temAcesso = true;
      try { temAcesso = (await getDoc(doc(db, 'usuarios', u.uid))).exists(); } catch { /* sem permissão de ler: quem decide são as regras, na hora de usar */ }
      if (!temAcesso) {
        throw new Error('A conta ' + (u.email || '') + ' entrou, mas ainda não tem acesso no Entregas. No Firestore do Entregas, crie usuarios/' + u.uid + ' com o papel do contábil.');
      }
    },

    async entrar(usuario, senha) {
      try {
        await signInWithEmailAndPassword(auth, cr.emailDoUsuario(usuario), senha);
      } catch (e) {
        throw new Error(cr.mensagemDoLogin(String((e as { code?: string })?.code || (e as Error)?.message || e)), { cause: e });
      }
    },
    async sair() { await signOut(auth); },

    async pastaDoCliente(codigo) {
      try {
        const raiz = await getDoc(doc(db, 'driveIndice', 'raiz'));
        const clientes = (raiz.exists() ? (raiz.data().clientes as cr.PastaDoCliente[]) : null) || [];
        const pasta = cr.pastaDoCliente(clientes, codigo);
        if (!pasta) return null;
        const partes = await getDocs(collection(db, 'driveIndice', pasta.id, 'partes'));
        const itens = partes.docs.sort((a, b) => Number(a.id) - Number(b.id)).flatMap(p => (p.data().itens as cr.ItemDrive[]) || []);
        return { raiz: pasta.id, nome: pasta.nomePasta, itens };
      } catch (e) {
        if (semPermissao(e)) throw new Error('Seu usuário do Entregas não pode ver o Arquivo (precisa ser do contábil ou admin).', { cause: e });
        throw e;
      }
    },

    async baixar(id, nome, passo) {
      return baixarDoRobo(await this.link(id, nome, passo, 'baixar'), passo);
    },

    // os extratos que chegaram por e-mail (o robô do Gmail grava em extratosRecebidos; 08/10/2026)
    async extratosRecebidos(codigo, competencia) {
      if (codigo == null) return [];
      const s = await getDocs(query(collection(db, 'extratosRecebidos'), where('codigo', '==', String(codigo)), where('competencia', '==', competencia)));
      return s.docs.filter(d => d.data().status === 'novo').map(d => {
        const x = d.data();
        return {
          id: d.id, nome: String(x.nome || ''), competencia: String(x.competencia || ''),
          bancos: Array.isArray(x.bancos) ? x.bancos.map(String) : [],
          contas: Array.isArray(x.contas) ? (x.contas as { agencia?: unknown; conta?: unknown }[]).map(c => ({ agencia: String(c.agencia || ''), conta: String(c.conta || '') })) : [],
          em: String(x.em || ''), remetente: String(x.remetente || ''),
          origem: x.origem === 'drive' ? 'drive' : 'email', ...(x.fileId ? { fileId: String(x.fileId) } : {}),
        } satisfies ex.ExtratoRecebido;
      }).sort((a, b) => a.em.localeCompare(b.em));
    },
    async baixarRecebido(id) {
      const s = await getDocs(collection(db, 'extratosRecebidos', id, 'partes'));
      const b64 = s.docs.sort((a, b) => Number(a.data().n) - Number(b.data().n)).map(d => String(d.data().dados || '')).join('');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes.buffer;
    },
    async marcarRecebido(id, status, linha) {
      await updateDoc(doc(db, 'extratosRecebidos', id), { status, linha, importadoEm: new Date().toISOString(), importadoPor: acesso.quem || '' });
    },

    /**
     * Pede ao robô a cópia temporária (~30 min) e devolve o link dela — para ver, sem guardar. 'abrir' (o padrão):
     * o PDF abre no próprio navegador (só ver, sem baixar); 'baixar': vem como download (a importação lê os bytes).
     */
    async link(id, nome, passo, modo: 'abrir' | 'baixar' = 'abrir') {
      const u = auth.currentUser;
      if (!u) throw new Error('Entre com o usuário do Entregas primeiro.');
      passo?.('pedindo ao robô do Drive');
      const ref = await addDoc(collection(db, 'aberturasDrive'), {
        status: 'pendente', fileId: id, nome, modo,
        criadoEm: new Date().toISOString(), criadoPor: acesso.quem || 'nads', criadoPorUid: u.uid,
      });
      const url = await new Promise<string>((ok, falha) => {
        const fim = setTimeout(() => { parar(); falha(new Error('O robô do Drive não respondeu a tempo. Confira se ele está online e tente de novo.')); }, ESPERA_DO_ROBO_MS);
        const parar = onSnapshot(ref, d => {
          const p = d.data() || {};
          if (p.status === 'buscando') passo?.('o robô está buscando no Drive');
          if (p.status === 'pronto' && p.url) { clearTimeout(fim); parar(); ok(String(p.url)); }
          if (p.status === 'erro') { clearTimeout(fim); parar(); falha(new Error('O robô não conseguiu trazer o arquivo: ' + (p.erro || 'erro'))); }
        }, e => { clearTimeout(fim); falha(e); });
      });
      if (!url.startsWith(LINK_DO_ROBO)) throw new Error('O robô respondeu com um endereço inesperado.');
      return url;
    },

    async contatoDoCliente(codigo) {
      try {
        const r = await getDocs(query(collection(db, 'clientes'), where('codigoOrigem', '==', String(codigo)), limit(1)));
        const d = r.docs[0];
        if (!d) return null;
        const x = d.data();
        const emails = [x.email, ...((x.emails as string[]) || [])].map(e => String(e || '').trim().toLowerCase()).filter(Boolean);
        return { id: d.id, nome: String(x.nome || ''), emails: [...new Set(emails)], telefone: String(x.telefone || '') };
      } catch (e) {
        if (semPermissao(e)) throw new Error('Seu usuário do Entregas não pode ver o cadastro de clientes.', { cause: e });
        throw e;
      }
    },

    /** O arquivo para o Claudio Secretario (enviosSecretario, em pedaços), como a Tarefas › Drive faz. */
    async enviarAoDrive(arquivo, destino) {
      const u = auth.currentUser;
      if (!u) throw new Error('Entre com a conta do Entregas para mandar ao Drive.');
      const problema = entregas.problemaDoArquivo({ nome: arquivo.nome, tamanho: arquivo.bytes.length });
      if (problema) throw new Error(arquivo.nome + ': ' + problema);
      const partes = entregas.partesDoArquivo(arquivo.bytes);
      const ref = doc(collection(db, 'enviosSecretario'));
      await setDoc(ref, {
        status: 'enviando', nome: entregas.nomeParaEnviar(arquivo.nome), tamanho: arquivo.bytes.length, partes: partes.length,
        competencia: destino.competencia, cliente: destino.cliente.trim(), codigo: destino.codigo == null ? '' : String(destino.codigo),
        criadoEm: new Date().toISOString(), criadoPor: acesso.quem || 'nads', criadoPorUid: u.uid,
      });
      for (let i = 0; i < partes.length; i++) await setDoc(doc(ref, 'partes', String(i)), { dados: Bytes.fromUint8Array(partes[i]) });
      await updateDoc(ref, { status: 'pendente' });
    },

    /** Põe o e-mail na fila do robô (solicitacoesEmail, tipo 'um') e acompanha até ele enviar. */
    async pedirEmail(p, passo) {
      const u = auth.currentUser;
      if (!u) throw new Error('Entre com o usuário do Entregas primeiro.');
      passo?.('pondo na fila do robô');
      const ref = await addDoc(collection(db, 'solicitacoesEmail'), {
        tipo: 'um', clienteId: p.contato.id, clienteNome: p.contato.nome, para: p.para, assunto: p.assunto, corpo: p.corpo, ...(p.html ? { html: p.html } : {}),
        tipos: ['extrato'], competencia: p.competencia, status: 'pendente',
        criadoEm: serverTimestamp(), criadoPor: acesso.quem || 'nads', criadoPorEmail: u.email || '', criadoPorUid: u.uid, origem: 'nads',
      });
      const situacao = await new Promise<'enviado' | 'na-fila'>((ok, falha) => {
        const fim = setTimeout(() => { parar(); ok('na-fila'); }, ESPERA_DO_EMAIL_MS);
        const parar = onSnapshot(ref, d => {
          const s = d.data() || {};
          if (s.status === 'processando') passo?.('o robô está enviando');
          if (s.status === 'enviado') { clearTimeout(fim); parar(); ok('enviado'); }
          if (s.status === 'erro') { clearTimeout(fim); parar(); falha(new Error('O robô não enviou: ' + (s.erro || 'erro'))); }
        }, e => { clearTimeout(fim); falha(e); });
      });
      return { id: ref.id, situacao };
    },

    /** De qual Gmail o pedido sai: o setor de quem pede (usuarios) e o endereço da caixa (robo/estado.caixas). */
    async remetente() {
      const u = auth.currentUser;
      if (!u) throw new Error('Entre com o usuário do Entregas primeiro.');
      const [usuario, estado] = await Promise.all([
        getDoc(doc(db, 'usuarios', u.uid)).then(d => d.data() || null, () => null),
        getDoc(doc(db, 'robo', 'estado')).then(d => d.data() || null, () => null),
      ]);
      return entregas.remetenteDoPedido(usuario, estado?.caixas, estado?.envioPeloRobo === true);
    },

    async situacaoDosEmails(ids) {
      const r: Record<string, cr.SituacaoDoEmail> = {};
      await Promise.all(ids.map(async id => {
        const d = await getDoc(doc(db, 'solicitacoesEmail', id));
        const s = d.data();
        r[id] = !s ? { status: 'sumiu' } : { status: (s.status as cr.SituacaoDoEmail['status']) || 'pendente', ...(s.erro ? { erro: String(s.erro) } : {}) };
      }));
      return r;
    },

    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
  };
}
