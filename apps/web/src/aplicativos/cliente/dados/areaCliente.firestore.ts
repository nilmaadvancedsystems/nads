// A Área do Cliente no banco (17/10/2026; contrato em docs/area-do-cliente/contrato.md): o espelho areasCliente/{token}
// no Firestore do Entregas (entregas-2e5e2), SEM LOGIN. Um app Firebase só do site do cliente ('cliente'), só com o
// Firestore: o Auth nunca é carregado e nenhuma coleção interna é lida. O que as regras do banco deixam (bloco "Área do
// Cliente" do firestore.rules do Entregas):
//   ler   areasCliente/{token} (get, só se o link existe) e, enquanto ele existir, resumo/atual, guias (+ guias/{id}/pdf/{n},
//         n de 0), agenda/{AAAA-MM}, envios e chamados;
//   criar areaClienteChamados { token, chamadoId?, tipo, titulo?, texto, criadoEm } e
//         areaClienteEnvios { token, nome, tipo, mime, tamanho, base64 (até 700 KB), criadoEm } — as chaves exatas da regra.
// Link que não existe ou foi revogado: o banco recusa (permission-denied) e a tela mostra "link inválido"; revogado com a
// página aberta, a tela troca na hora. Do documento do link só sai o nome (para o topo, enquanto o robô não grava o
// resumo); os códigos e quem criou ficam fora da tela. A leitura campo a campo e os pedidos estão em espelho.ts.
import { getApps, initializeApp } from 'firebase/app';
import { addDoc as addDocBruto, collection, doc, getDoc, getDocs, getFirestore, initializeFirestore, onSnapshot, query, serverTimestamp, where, type DocumentSnapshot, type Firestore, type FirestoreError } from 'firebase/firestore';
import { confirmPasswordReset, getAuth, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, verifyPasswordResetCode, type Auth } from 'firebase/auth';
import { areaCliente as ac, demo, type mandei } from '@nads/core';
import { MENSAGEM_BLOQUEADO, recusarNoModoDev } from '../../../comum/travaDoModoDev';
import { AREA_VAZIA, type AvisoDoEscritorio, type CertificadoDigital, type EstadoDaArea, type FichaDaEmpresa, type RepoAreaCliente } from './areaCliente';
import type { DanfeNoEspelho } from './biblioteca';
import {
  base64DosBytes, ehTokenDoLink, estadoDoEspelho, lerAgenda, lerChamado, lerDocumentoDp, lerFaturamento, lerDanfe, lerGuia, lerListaDeNotas, lerExtratoDoMes, lerMarca, lerCertificado, lerCertidao, lerEntregas, lerParcelamentos, lerDocumentoDoEscritorio, lerFicha, lerPendencias, lerComunicados, lerTickets, lerPessoal, lerRecibo, lerResumo, nomeDoPdfDaGuia, pedidoDeChamado, pedidoDeEnvio, respostaVoltou,
  type ChamadoPendente, type PartesDoEspelho, type RespostaPendente,
} from './espelho';
import { juntarPedacosDoPdf, mimeDoArquivo, type PedacoDoPdf } from './regras';

// o modo desenvolvedor do nads (13/11/2026: a Área do Cliente aberta dentro da Tarefas, no módulo Desenvolvedor): lê o banco
// de verdade, mas nenhum pedido sai — solicitação, resposta, envio de arquivo e pedido de DANFE (que aciona o robô). A trava
// é a leve (travaDoModoDev.ts, sem imports): nada do escritório entra no pacote do site do cliente.
const addDoc = recusarNoModoDev(addDocBruto) as typeof addDocBruto;

/** Configuração web pública do projeto do Entregas (a mesma das páginas de lá). */
const CONFIG_ENTREGAS = {
  apiKey: 'AIzaSyD6xg7XhX8dKTKmaYup4hRX5k9XFHEkb98',
  authDomain: 'entregas-2e5e2.firebaseapp.com',
  projectId: 'entregas-2e5e2',
  storageBucket: 'entregas-2e5e2.firebasestorage.app',
  messagingSenderId: '1009094556836',
  appId: '1:1009094556836:web:d3b6a9283e934db064fa31',
};

/** O banco, aberto na primeira vez que alguém precisa (o token "exemplo" nunca abre). */
export function bancoDoCliente(): Firestore {
  const app = getApps().find(a => a.name === 'cliente') ?? initializeApp(CONFIG_ENTREGAS, 'cliente');
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app); // já aberto nesta página
  }
}

/**
 * O login de quem tem senha (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por pessoa"): o mesmo app 'cliente' do banco, então o
 * Firestore já leva o login nas leituras. Só é aberto quando um link pede senha (o link sem senha nunca carrega o Auth).
 */
function loginDoCliente(): Auth {
  const app = getApps().find(a => a.name === 'cliente') ?? initializeApp(CONFIG_ENTREGAS, 'cliente');
  const auth = getAuth(app);
  auth.languageCode = 'pt-BR';
  return auth;
}

/**
 * O idToken de quem entrou com senha, para a função do SCI Report conferir o link com "Exigir senha" (24/11/2026); '' sem
 * login. Quem chama só pede depois que a função respondeu "precisa entrar": o link sem senha continua sem carregar o Auth.
 */
export async function idTokenDoCliente(): Promise<string> {
  try { return (await loginDoCliente().currentUser?.getIdToken()) ?? ''; } catch { return ''; }
}

/** O erro do login em português (sem dizer se o e-mail existe: só "não deu") */
function erroDoLogin(e: unknown): string {
  const c = String((e as { code?: string } | null)?.code ?? '');
  if (c === 'auth/too-many-requests') return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if (c === 'auth/network-request-failed') return 'Sem internet agora. Confira a conexão e tente de novo.';
  if (c === 'auth/invalid-email') return 'Este e-mail não parece certo.';
  if (c === 'auth/invalid-credential' || c === 'auth/wrong-password' || c === 'auth/user-not-found' || c === 'auth/invalid-login-credentials')
    return 'E-mail ou senha não conferem. Se for o primeiro acesso, use "Criar ou trocar a senha".';
  // o resto (um problema do lado do escritório): o código ajuda o escritório a achar a causa
  return 'Não deu certo agora' + (c ? ' (' + c.replace('auth/', '') + ')' : '') + '. Tente de novo; se continuar, avise o escritório.';
}

/** O erro do link de criar a senha (o código do e-mail) (19/11/2026; o dono, sobre a página "Senha alterada" do Firebase: "tem como melhorar isso?") */
function erroDoCodigo(e: unknown): string {
  const c = String((e as { code?: string } | null)?.code ?? '');
  if (c === 'auth/expired-action-code' || c === 'auth/invalid-action-code') return 'Este link já foi usado ou venceu. Peça outro na tela de entrar, em "Criar ou trocar a senha".';
  if (c === 'auth/weak-password') return 'Esta senha é fraca demais. Use pelo menos 8 letras e números.';
  if (c === 'auth/network-request-failed') return 'Sem internet agora. Confira a conexão e tente de novo.';
  return 'Não deu certo agora' + (c ? ' (' + c.replace('auth/', '') + ')' : '') + '. Tente de novo; se continuar, avise o escritório.';
}

const LINK_RUIM = 'Este link não vale mais. Peça um novo ao escritório.';
/** a mensagem do erro do banco para o cliente: o link revogado ou a internet */
function mensagemDoErro(e: unknown): string {
  if (e instanceof Error && e.message === MENSAGEM_BLOQUEADO) return MENSAGEM_BLOQUEADO;
  const codigo = (e as { code?: string } | null)?.code ?? '';
  return codigo === 'permission-denied' ? LINK_RUIM : 'Não deu para mandar agora. Confira a internet e tente de novo.';
}
/** o link não existe, foi revogado ou trocado: as regras recusam a leitura */
const linkRecusado = (e: FirestoreError) => e.code === 'permission-denied' || e.code === 'not-found';

/**
 * A empresa de teste (Vitor, 13/11/2026: "quero que a personaly company sempre fique com dados de teste"): o link da
 * PERSONALY COMPANY (código 9999, @nads/core/demo) tem o espelho quase vazio no banco. Aberto, ele mostra os dados de
 * exemplo da Área do Cliente (o repositório de exemplo, com o token dele), e o que a pessoa faz ali (solicitação, envio,
 * DANFE) fica só na página, sem ir ao banco.
 */
export interface AreaDeTeste { repo: RepoAreaCliente; token: string }

/** O link é da empresa de teste? (os códigos do documento do link) */
export const linkDaEmpresaDeTeste = (codigos: unknown) => Array.isArray(codigos) && codigos.includes(demo.EMPRESA_DEMO.codigo);

// o "Novo" do acervo do escritório até baixar (17/11/2026, ficha documentos-do-escritorio): guardado neste aparelho, por
// link (no máximo 300 por link e 30 links); sem armazenamento, o selo fica até a página fechar
const CHAVE_DOS_BAIXADOS = 'nads-area-cliente|baixados';
function lerBaixados(): Record<string, string[]> {
  try { const x: unknown = JSON.parse(localStorage.getItem(CHAVE_DOS_BAIXADOS) || '{}'); return x && typeof x === 'object' ? x as Record<string, string[]> : {}; } catch { return {}; }
}
function baixadosDoEscritorio(token: string): Set<string> {
  const l = lerBaixados()[token];
  return new Set(Array.isArray(l) ? l.filter(i => typeof i === 'string') : []);
}
function marcarBaixado(token: string, id: string): void {
  try {
    const todos = lerBaixados();
    const deste = [...new Set([...(Array.isArray(todos[token]) ? todos[token] : []), id])].slice(-300);
    const outros = Object.entries(todos).filter(([t]) => t !== token).slice(-29);
    localStorage.setItem(CHAVE_DOS_BAIXADOS, JSON.stringify(Object.fromEntries([...outros, [token, deste]])));
  } catch { /* sem armazenamento */ }
}

export function criarRepoAreaClienteFirestore(banco: () => Firestore = bancoDoCliente, teste?: AreaDeTeste): RepoAreaCliente {
  // os links abertos nesta página que são da empresa de teste: dali em diante, tudo deles vai para o exemplo
  const deTeste = new Set<string>();
  let db: Firestore | null = null;
  const abrir = () => (db ??= banco());
  // as empresas (os links) que um login abre, com o nome do documento do link (a regra do banco deixa ler o próprio)
  const empresasDoLogin = async (claims: object): Promise<{ token: string; nome: string }[]> => {
    const a = (claims as { a?: unknown }).a;
    const tokens = Array.isArray(a) ? a.filter((t): t is string => typeof t === 'string' && ehTokenDoLink(t)) : [];
    const b = abrir();
    return Promise.all(tokens.map(async token => {
      const s = await getDoc(doc(b, 'areasCliente', token)).catch(() => null);
      const nome = s?.exists() ? s.get('nome') : '';
      return { token, nome: typeof nome === 'string' && nome.trim() ? nome.trim() : 'Sua empresa' };
    }));
  };

  // o que o cliente mandou nesta página e o robô ainda não devolveu pelo espelho (por token)
  const novos = new Map<string, ChamadoPendente[]>();
  const respostas = new Map<string, RespostaPendente[]>();
  // o último espelho de cada token (o tipo do chamado na resposta, o nome do PDF da guia) e quem redesenhar
  const ultimo = new Map<string, PartesDoEspelho>();
  const redesenhar = new Map<string, Set<() => void>>();
  const avisarToken = (token: string) => redesenhar.get(token)?.forEach(f => f());

  const doBanco: RepoAreaCliente = {
    assinar(token, aoMudar) {
      if (!ehTokenDoLink(token)) { aoMudar({ ...AREA_VAZIA, carregado: true }); return () => undefined; }
      const banco = abrir();
      const espelho = doc(banco, 'areasCliente', token);
      const paradas: (() => void)[] = [];
      let parado = false;
      let nomeDoLink = '';
      // undefined = ainda não chegou
      const partes: { resumo?: ac.ResumoDoCliente | null; guias?: ac.GuiaDoCliente[]; agenda?: ac.AgendaDoMes[]; envios?: ac.ReciboDeEnvio[]; chamados?: ac.ChamadoDoCliente[];
        pessoal?: ac.ResumoDoPessoal | null; documentosDp?: ac.DocumentoDoDp[]; faturamento?: ac.ResumoDoFaturamento | null; logo?: string | null; danfes?: DanfeNoEspelho[]; certificado?: CertificadoDigital | null; avisos?: AvisoDoEscritorio[]; comunicados?: ac.ComunicadoNaArea[]; tickets?: mandei.TicketNaArea[]; documentos?: PartesDoEspelho['documentos']; certidoes?: PartesDoEspelho['documentos']; ficha?: FichaDaEmpresa | null; entregas?: ac.EntregaParaConfirmar[]; parcelamentos?: ac.ParcelamentoNaArea[] } = {};

      const parar = () => { parado = true; paradas.splice(0).forEach(f => f()); redesenhar.get(token)?.delete(desenhar); };
      const mostrar = (e: EstadoDaArea) => { if (!parado) aoMudar(e); };
      // depois de parar (a tela saiu, ou já mostrou o link inválido), nada mais chega à tela
      const invalido = () => { if (parado) return; parar(); aoMudar({ ...AREA_VAZIA, carregado: true }); };
      const falhou = (e: FirestoreError) => {
        if (linkRecusado(e)) { invalido(); return; }
        if (parado) return;
        parar();
        aoMudar({ ...AREA_VAZIA, carregado: true, erro: 'Não deu para abrir a sua área agora. Tente de novo em alguns minutos.' });
      };
      function desenhar() {
        const { resumo, guias, agenda, envios, chamados, pessoal, documentosDp, faturamento, logo } = partes;
        if (resumo === undefined || !guias || !agenda || !envios || !chamados || pessoal === undefined || !documentosDp || faturamento === undefined || logo === undefined) return;
        // (17/11/2026) as partes que não seguram a tela vão junto: o certificado, o que falta mandar, os pedidos do Mandei e o
        // acervo do escritório (antes ficavam lidas e não chegavam à tela)
        const p: PartesDoEspelho = { resumo, nomeDoLink, guias, agenda, envios, chamados, pessoal, documentosDp, faturamento, logo, danfes: partes.danfes ?? [],
          certificado: partes.certificado ?? null, avisos: partes.avisos ?? [], comunicados: partes.comunicados ?? [], tickets: partes.tickets ?? [], documentos: [...(partes.documentos ?? []), ...(partes.certidoes ?? [])], ficha: partes.ficha ?? null, entregas: partes.entregas ?? [], parcelamentos: partes.parcelamentos ?? [] };
        ultimo.set(token, p);
        // o que já voltou pelo espelho sai da lista dos pendentes
        novos.set(token, (novos.get(token) ?? []).filter(n => !chamados.some(c => c.id === n.id)));
        respostas.set(token, (respostas.get(token) ?? []).filter(r => !respostaVoltou(r, chamados)));
        mostrar(estadoDoEspelho(p, novos.get(token), respostas.get(token)));
      }
      if (!redesenhar.has(token)) redesenhar.set(token, new Set());
      redesenhar.get(token)!.add(desenhar);

      /** uma subcoleção do espelho ao vivo: cada documento lido e conferido (o torto fica de fora) */
      function ouvirColecao<T>(nome: string, ler: (id: string, x: unknown) => T | null, guardar: (l: T[]) => void) {
        paradas.push(onSnapshot(collection(espelho, nome), s => {
          guardar(s.docs.map(d => ler(d.id, d.data())).filter((x): x is T => x != null));
          desenhar();
        }, falhou));
      }

      let ouvindoEspelho = false;
      // a senha (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por pessoa"): o link com exigeSenha só abre o espelho para quem entrou com
      // um e-mail que tem este link no login (a regra do banco confere o mesmo); sem isso, a tela de entrar
      let autorizado = false;
      let ultimaFoto: DocumentSnapshot | null = null;
      let ouvindoLogin = false;
      const ouvirLogin = () => {
        if (ouvindoLogin) return;
        ouvindoLogin = true;
        paradas.push(onAuthStateChanged(loginDoCliente(), u => {
          void (u ? u.getIdTokenResult(true) : Promise.resolve(null)).then(r => {
            const agora = ac.clienteAbreOLink(r?.claims, token);
            if (agora === autorizado) return;
            autorizado = agora;
            // entrou: abre o espelho; saiu com ele aberto: recomeça (a tela de entrar volta)
            if (autorizado && ultimaFoto) aoLink(ultimaFoto);
            else if (!autorizado && ouvindoEspelho) { parar(); aoMudar({ ...AREA_VAZIA, carregado: true, valido: true, pedeLogin: { nome: nomeDoLink } }); }
          }).catch(() => undefined);
        }));
      };
      // primeiro o link: só com ele de pé o resto é ouvido (link ruim = um só "permission-denied", não seis)
      let pararTeste: (() => void) | null = null;
      const aoLink = (s: DocumentSnapshot) => {
        ultimaFoto = s;
        if (!s.exists()) { invalido(); return; }
        const nome = s.get('nome');
        nomeDoLink = typeof nome === 'string' ? nome.trim() : '';
        // a senha vem antes de tudo, também na empresa de teste (assim dá para testar a tela de entrar nela; 18/11/2026)
        if (s.get('exigeSenha') === true && !autorizado) {
          ouvirLogin();
          if (!ouvindoEspelho && !pararTeste) mostrar({ ...AREA_VAZIA, carregado: true, valido: true, pedeLogin: { nome: nomeDoLink } });
          return;
        }
        // a empresa de teste: para de ouvir o banco e mostra os dados de exemplo
        if (teste && linkDaEmpresaDeTeste(s.get('codigos'))) {
          if (pararTeste) return;
          parar();
          deTeste.add(token);
          pararTeste = teste.repo.assinar(teste.token, aoMudar);
          return;
        }
        if (ouvindoEspelho) { desenhar(); return; }
        ouvindoEspelho = true;
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'atual'), r => { partes.resumo = r.exists() ? lerResumo(r.data()) : null; desenhar(); }, falhou));
        ouvirColecao('guias', lerGuia, l => { partes.guias = l; });
        ouvirColecao('agenda', lerAgenda, l => { partes.agenda = l; });
        ouvirColecao('envios', lerRecibo, l => { partes.envios = l; });
        ouvirColecao('chamados', lerChamado, l => { partes.chamados = l; });
        // o Registro (12/11/2026): os funcionários e os documentos do DP (os pedaços dos arquivos ficam de fora: não têm tipo)
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'pessoal'), r => { partes.pessoal = r.exists() ? lerPessoal(r.data()) : null; desenhar(); }, falhou));
        // o Faturamento (12/11/2026): os 12 meses pelas notas emitidas no SIEG
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'faturamento'), r => { partes.faturamento = r.exists() ? lerFaturamento(r.data()) : null; desenhar(); }, falhou));
        // a logo da empresa (12/11/2026), que o gestor põe no nads
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'marca'), r => { partes.logo = r.exists() ? lerMarca(r.data()) : null; desenhar(); }, falhou));
        // o que falta mandar e os pedidos do Mandei, no sino (plano do Acessórias, 17/11/2026, fichas o-que-falta-mandar e pedidos-do-mandei; frase do dono: "No sino"): não seguram a tela
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'pendencias'), r => { partes.avisos = r.exists() ? lerPendencias(r.data()) : []; desenhar(); }, () => { partes.avisos = []; desenhar(); }));
        // os comunicados do escritório (22/11/2026, ficha comunicados): sem eles, a tela segue
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'comunicados'), r => { partes.comunicados = r.exists() ? lerComunicados(r.data()) : []; desenhar(); }, () => { partes.comunicados = []; desenhar(); }));
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'tickets'), r => { partes.tickets = r.exists() ? lerTickets(r.data()) : []; desenhar(); }, () => { partes.tickets = []; desenhar(); }));
        // o certificado A1 do cofre (17/11/2026, ficha certificado-digital): não segura a tela
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'certificado'), r => { partes.certificado = r.exists() ? lerCertificado(r.data()) : null; desenhar(); }, () => { partes.certificado = null; desenhar(); }));
        paradas.push(onSnapshot(query(collection(espelho, 'documentos'), where('tipo', '==', 'dp')), s => {
          partes.documentosDp = s.docs.map(d => lerDocumentoDp(d.id, d.data())).filter((x): x is ac.DocumentoDoDp => x != null);
          desenhar();
        }, falhou));
        // a ficha cadastral (plano do Acessórias, 18/11/2026, ficha dados-cadastrais; frase do dono: "Sim, comece assim"): não segura a tela
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'ficha'), r => { partes.ficha = r.exists() ? lerFicha(r.data()) : null; desenhar(); }, () => { partes.ficha = null; desenhar(); }));
        // as entregas a confirmar (plano do Acessórias, 18/11/2026, ficha confirmar-entrega): não seguram a tela
        // os parcelamentos (plano do Acessórias, 18/11/2026, ficha parcelamentos; frase do dono: "Serve, seguir"): não seguram a tela
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'parcelamentos'), r => { partes.parcelamentos = r.exists() ? lerParcelamentos(r.data()) : []; desenhar(); }, () => { partes.parcelamentos = []; desenhar(); }));
        paradas.push(onSnapshot(doc(espelho, 'resumo', 'entregas'), r => { partes.entregas = r.exists() ? lerEntregas(r.data()) : []; desenhar(); }, () => { partes.entregas = []; desenhar(); }));
        // as certidões (plano do Acessórias, 18/11/2026, ficha certidoes): não seguram a tela
        paradas.push(onSnapshot(query(collection(espelho, 'documentos'), where('tipo', '==', 'certidao')), s => {
          const baixados = baixadosDoEscritorio(token);
          partes.certidoes = s.docs.map(d => lerCertidao(d.id, d.data(), baixados)).filter((x): x is NonNullable<typeof x> => x != null);
          desenhar();
        }, () => { partes.certidoes = []; desenhar(); }));
        // o acervo do escritório (plano do Acessórias, 17/11/2026, ficha documentos-do-escritorio; frase do dono: "Pasta fixa"): não segura a tela
        paradas.push(onSnapshot(query(collection(espelho, 'documentos'), where('tipo', '==', 'escritorio')), s => {
          const baixados = baixadosDoEscritorio(token);
          partes.documentos = s.docs.map(d => lerDocumentoDoEscritorio(d.id, d.data(), baixados)).filter((x): x is NonNullable<typeof x> => x != null);
          desenhar();
        }, () => { partes.documentos = []; desenhar(); }));
        // as DANFEs prontas (12/11/2026, a pasta Notas da Central): não seguram a tela (chegam quando chegarem)
        paradas.push(onSnapshot(query(collection(espelho, 'documentos'), where('tipo', '==', 'danfe')), s => {
          partes.danfes = s.docs.map(d => lerDanfe(d.id, d.data())).filter((x): x is DanfeNoEspelho => x != null);
          desenhar();
        }, () => { partes.danfes = []; desenhar(); }));
      };
      paradas.push(onSnapshot(espelho, aoLink, falhou));
      return () => { parar(); pararTeste?.(); };
    },

    // a senha (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma por pessoa")
    async entrar(token, email, senha) {
      const auth = loginDoCliente();
      let claims: unknown;
      try {
        const c = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), senha);
        claims = (await c.user.getIdTokenResult(true)).claims;
      } catch (e) { throw new Error(erroDoLogin(e), { cause: e }); }
      if (!ac.clienteAbreOLink(claims, token)) {
        await signOut(auth).catch(() => undefined);
        throw new Error('Este e-mail não tem acesso a esta empresa. Peça ao escritório para incluir você.');
      }
    },
    async criarSenha(token, email) {
      const e = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) throw new Error('Este e-mail não parece certo.');
      // primeiro pelo robô (19/11/2026; o dono: "Sim, pelo robô"): o e-mail da Nilma, em português, com o link da página
      // própria. O robô só manda se este e-mail tem acesso a este link. Se a caixa ainda não aceitar (a regra), o e-mail do Firebase
      const pedido = ac.pedidoDeSenha(token, e);
      if (pedido) {
        try { await addDoc(collection(abrir(), 'areaClienteSenhas'), { ...pedido, criadoEm: serverTimestamp() }); return; }
        catch (err) { if (err instanceof Error && err.message === MENSAGEM_BLOQUEADO) throw err; /* segue para o e-mail do Firebase */ }
      }
      // volta para este link depois de criar a senha; o Firebase não diz se o e-mail existe (não deixa adivinhar quem tem acesso).
      // Se o domínio da Área ainda não estiver na lista do login do Firebase (19/11/2026: UNAUTHORIZED_DOMAIN), manda sem a
      // volta: a pessoa cria a senha na página do Firebase e abre o link de novo
      const codigo = (err: unknown) => String((err as { code?: string } | null)?.code ?? '');
      try { await sendPasswordResetEmail(loginDoCliente(), e, { url: location.origin + '/cliente/' + token }); }
      catch (err) {
        if (codigo(err) === 'auth/user-not-found') return;
        if (!/unauthorized-(continue-uri|domain)|invalid-continue-uri/.test(codigo(err))) throw new Error(erroDoLogin(err), { cause: err });
        try { await sendPasswordResetEmail(loginDoCliente(), e); }
        catch (err2) { if (codigo(err2) !== 'auth/user-not-found') throw new Error(erroDoLogin(err2), { cause: err2 }); }
      }
    },
    async sair() {
      await signOut(loginDoCliente()).catch(() => undefined);
    },
    // a página própria de criar a senha (19/11/2026; o dono, sobre a página "Senha alterada" do Firebase: "tem como melhorar isso?")
    async conferirCodigoDaSenha(codigo) {
      try { return await verifyPasswordResetCode(loginDoCliente(), codigo); }
      catch (e) { throw new Error(erroDoCodigo(e), { cause: e }); }
    },
    async gravarSenha(codigo, senha) {
      const auth = loginDoCliente();
      let email: string;
      try { email = await verifyPasswordResetCode(auth, codigo); await confirmPasswordReset(auth, codigo, senha); }
      catch (e) { throw new Error(erroDoCodigo(e), { cause: e }); }
      // já entra com a senha nova e acha as empresas que esta pessoa abre (o nome vem do documento do link)
      try {
        const c = await signInWithEmailAndPassword(auth, email, senha);
        return await empresasDoLogin((await c.user.getIdTokenResult(true)).claims);
      } catch { return []; }
    },

    acompanharConta(aoMudar) {
      let vivo = true;
      // cada mudança do login vale só se for a última (entrar e sair rápido não mistura as respostas)
      let vez = 0;
      const parar = onAuthStateChanged(loginDoCliente(), u => {
        const minha = ++vez;
        if (!u || !u.email) { aoMudar(null); return; }
        const email = u.email;
        void u.getIdTokenResult().then(r => empresasDoLogin(r.claims)).catch(() => [])
          .then(empresas => { if (vivo && minha === vez) aoMudar(empresas.length ? { email, empresas } : null); });
      });
      return () => { vivo = false; parar(); };
    },

    async abrirChamado(token, { tipo, texto }) {
      // a foto da admissão não vai: a caixa do banco ainda não tem campo para ela (e o Departamento pessoal está escondido)
      const p = pedidoDeChamado(token, { tipo, texto });
      if ('erro' in p) throw new Error(p.erro);
      let id: string;
      try {
        id = (await addDoc(collection(abrir(), 'areaClienteChamados'), { ...p.pedido, criadoEm: serverTimestamp() })).id;
      } catch (e) { throw new Error(mensagemDoErro(e), { cause: e }); }
      novos.set(token, [...(novos.get(token) ?? []), { id, tipo: p.pedido.tipo, titulo: p.pedido.titulo ?? '', texto: p.pedido.texto, em: new Date().toISOString() }]);
      avisarToken(token);
      return id;
    },

    async responderChamado(token, id, texto) {
      const chamado = ultimo.get(token)?.chamados.find(c => c.id === id);
      if (!chamado) throw new Error('Este chamado ainda não chegou ao escritório. Espere um pouco e tente de novo.');
      if (!ac.chamadoAceitaResposta(chamado)) throw new Error('Chamado concluído. Para outro assunto, abra um novo.');
      const p = pedidoDeChamado(token, { tipo: chamado.tipo, texto, chamadoId: id });
      if ('erro' in p) throw new Error(p.erro);
      try {
        await addDoc(collection(abrir(), 'areaClienteChamados'), { ...p.pedido, criadoEm: serverTimestamp() });
      } catch (e) { throw new Error(mensagemDoErro(e), { cause: e }); }
      respostas.set(token, [...(respostas.get(token) ?? []), { chamadoId: id, texto: p.pedido.texto, em: new Date().toISOString() }]);
      avisarToken(token);
    },

    async enviar(token, tipo, arquivos) {
      // confere todos antes de mandar o primeiro (um arquivo ruim no meio não deixa metade enviada sem aviso)
      const pedidos = [];
      for (const a of arquivos) {
        const p = pedidoDeEnvio(token, tipo, { nome: a.name, tamanho: a.size }, a.size > ac.MAIOR_ENVIO ? '' : base64DosBytes(new Uint8Array(await a.arrayBuffer())));
        if ('erro' in p) throw new Error(p.erro);
        pedidos.push(p.pedido);
      }
      for (const pedido of pedidos) {
        try {
          await addDoc(collection(abrir(), 'areaClienteEnvios'), { ...pedido, criadoEm: serverTimestamp() });
        } catch (e) { throw new Error(pedido.nome + ': ' + mensagemDoErro(e), { cause: e }); }
      }
    },

    async baixarGuia(token, id) {
      /**
       * o registro de abertura (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura; frase do dono: "vamos continuar"): baixou a guia, o pedido
       * marcado vai para o robô uma vez por guia, por aparelho, por dia; o erro do pedido não atrapalha o download
       */
      async function registrarLeitura(t: string, guiaId: string) {
        try {
          const pedido = ac.pedidoDeLeitura(guiaId);
          if (!pedido) return;
          const CHAVE = 'nads-area-cliente|lidas';
          const hoje = new Date().toISOString().slice(0, 10);
          let registros: Record<string, string> = {};
          try { const x: unknown = JSON.parse(localStorage.getItem(CHAVE) || '{}'); if (x && typeof x === 'object') registros = x as Record<string, string>; } catch { /* sem armazenamento */ }
          const chave = t + '|' + guiaId;
          if (ac.jaRegistrouHoje(registros, chave, hoje)) return;
          await addDoc(collection(abrir(), 'areaClienteChamados'), { token: t, ...pedido, criadoEm: serverTimestamp() });
          // guarda só os de hoje (a lista não cresce)
          const deHoje = Object.fromEntries(Object.entries(registros).filter(([, d]) => d === hoje));
          try { localStorage.setItem(CHAVE, JSON.stringify({ ...deHoje, [chave]: hoje })); } catch { /* sem armazenamento */ }
        } catch { /* o registro é um extra: o download continua */ }
      }
      if (!ehTokenDoLink(token) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
      try {
        const s = await getDocs(collection(abrir(), 'areasCliente', token, 'guias', id, 'pdf'));
        const pedacos: PedacoDoPdf[] = s.docs.map(d => d.data()).filter(x => typeof x.base64 === 'string' && typeof x.n === 'number' && typeof x.total === 'number')
          .map(x => ({ base64: x.base64 as string, n: x.n as number, total: x.total as number }));
        const arquivo = juntarPedacosDoPdf(pedacos);
        if (arquivo) void registrarLeitura(token, id);
        return arquivo ? { nome: nomeDoPdfDaGuia(ultimo.get(token)?.guias.find(g => g.id === id) ?? null), arquivo } : null;
      } catch {
        return null;
      }
    },

    // sem fonte no banco por enquanto (as seções estão escondidas): nada a baixar
    // o acervo do escritório (plano do Acessórias, 17/11/2026, ficha documentos-do-escritorio; frase do dono: "Pasta fixa"): os pedaços, como o documento do DP; baixou, sai o "Novo"
    async baixarDocumento(token, id) {
      if (!ehTokenDoLink(token) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
      try {
        const s = await getDocs(query(collection(abrir(), 'areasCliente', token, 'documentos'), where('de', '==', id)));
        const pedacos: PedacoDoPdf[] = s.docs.map(d => d.data()).filter(x => typeof x.base64 === 'string' && typeof x.n === 'number' && typeof x.total === 'number')
          .map(x => ({ base64: x.base64 as string, n: x.n as number, total: x.total as number }));
        const nome = ultimo.get(token)?.documentos?.find(d => d.id === id)?.nome || 'documento';
        const arquivo = juntarPedacosDoPdf(pedacos, mimeDoArquivo(nome));
        if (arquivo) marcarBaixado(token, id);
        return arquivo ? { nome, arquivo } : null;
      } catch {
        return null;
      }
    },
    async baixarComprovante() { return null; },

    // a DANFE (12/11/2026): se já está no espelho (documentos/danfe-<chave>), baixa; senão pede pela caixa dos chamados
    // (o pedido marcado que o robô reconhece) e espera o documento chegar, até 3 min
    // a avaliação da solicitação concluída (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento; frase do dono: "Seguir"): o pedido marcado, pelo addDoc travado
    async avaliarChamado(token, chamadoId, nota, comentario) {
      const pedido = ac.pedidoDeAvaliacao(chamadoId, nota, comentario);
      if (!ehTokenDoLink(token) || !pedido) throw new Error('Esta avaliação não pode ser enviada.');
      await addDoc(collection(abrir(), 'areaClienteChamados'), { token, ...pedido, criadoEm: serverTimestamp() });
    },
    // "Confirmar que recebi" (plano do Acessórias, 18/11/2026, ficha confirmar-entrega): o pedido marcado, pelo addDoc travado (modo desenvolvedor recusa)
    async confirmarRecebido(token, entregaId) {
      const pedido = ac.pedidoDeRecebido(entregaId);
      if (!ehTokenDoLink(token) || !pedido) throw new Error('Esta entrega não pode ser confirmada.');
      await addDoc(collection(abrir(), 'areaClienteChamados'), { token, ...pedido, criadoEm: serverTimestamp() });
    },
    // o aceite da política de privacidade (22/11/2026, ficha aceite-lgpd): areaClienteAceites { token, versao, criadoEm } (regra nova: o cliente só cria)
    async aceitarPolitica(token, versao) {
      const pedido = ac.pedidoDeAceite(token, versao);
      if (!pedido) return;
      await addDoc(collection(abrir(), 'areaClienteAceites'), { ...pedido, criadoEm: serverTimestamp() });
    },
    // "Não tive movimento" (22/11/2026, Documentos do cliente): o pedido marcado, pela caixa dos chamados (sem regra nova)
    async marcarSemMovimento(token, competencia) {
      const pedido = ac.pedidoDeSemMovimento(competencia);
      if (!ehTokenDoLink(token) || !pedido) throw new Error('Este mês não pode ser marcado.');
      try { await addDoc(collection(abrir(), 'areaClienteChamados'), { token, ...pedido, criadoEm: serverTimestamp() }); }
      catch (e) { throw new Error(mensagemDoErro(e), { cause: e }); }
    },
    async pedirDanfe(token, chave) {
      const pedido = ac.pedidoDeDanfe(chave);
      if (!ehTokenDoLink(token) || !pedido) return { erro: 'Esta nota não tem DANFE.' };
      const banco = abrir();
      const id = ac.idDaDanfe(ac.chaveDeNota(chave));
      const ref = doc(banco, 'areasCliente', token, 'documentos', id);
      try {
        let meta = (await getDoc(ref)).data();
        if (!meta || meta.erro || !(Number(meta.partes) > 0)) {
          const inicio = new Date(Date.now() - 60_000).toISOString();
          await addDoc(collection(banco, 'areaClienteChamados'), { token, ...pedido, criadoEm: serverTimestamp() });
          meta = await new Promise<Record<string, unknown> | undefined>(ok => {
            const fim = setTimeout(() => { parar(); ok(undefined); }, 180_000);
            const parar = onSnapshot(ref, s => {
              const x = s.data();
              if (x && (Number(x.partes) > 0 || (x.erro && String(x.atualizadoEm || '') >= inicio))) { clearTimeout(fim); parar(); ok(x); }
            }, () => { clearTimeout(fim); parar(); ok(undefined); });
          });
        }
        if (!meta) return { erro: 'O escritório não respondeu a tempo. Tente de novo em alguns minutos.' };
        if (meta.erro) return { erro: String(meta.erro) };
        const s = await getDocs(query(collection(banco, 'areasCliente', token, 'documentos'), where('de', '==', id)));
        const pedacos: PedacoDoPdf[] = s.docs.map(d => d.data()).filter(x => typeof x.base64 === 'string' && typeof x.n === 'number' && typeof x.total === 'number')
          .map(x => ({ base64: x.base64 as string, n: x.n as number, total: x.total as number }));
        const arquivo = juntarPedacosDoPdf(pedacos, 'application/pdf');
        return arquivo ? { nome: String(meta.nome || 'DANFE.pdf'), arquivo } : { erro: 'A DANFE chegou incompleta. Tente de novo.' };
      } catch (e) {
        return { erro: mensagemDoErro(e) };
      }
    },

    // o relatório do dia (12/11/2026): as notas do mês, um documento por empresa e mês (uma leitura ao abrir o dia)
    async notasDoMes(token, codigo, mes) {
      if (!ehTokenDoLink(token) || !Number.isInteger(codigo) || !/^\d{4}-\d{2}$/.test(mes)) return null;
      try {
        const s = await getDoc(doc(abrir(), 'areasCliente', token, 'resumo', 'notas-' + codigo + '-' + mes));
        return s.exists() ? lerListaDeNotas(s.data()) : null;
      } catch {
        return null;
      }
    },

    // os lançamentos do mês pelos extratos (13/11/2026): um documento por empresa e mês, lido ao abrir a aba Banco
    async extratoDoMes(token, codigo, mes) {
      if (!ehTokenDoLink(token) || !Number.isInteger(codigo) || !/^\d{4}-\d{2}$/.test(mes)) return null;
      try {
        const s = await getDoc(doc(abrir(), 'areasCliente', token, 'resumo', 'extrato-' + codigo + '-' + mes));
        return s.exists() ? lerExtratoDoMes(s.data()) : null;
      } catch {
        return null;
      }
    },

    // o documento do DP: os pedaços em documentos/{id}~{n}, com 'de' = o id do documento
    async baixarDocumentoDp(token, id) {
      if (!ehTokenDoLink(token) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
      try {
        // o mês antigo (ficha 37, 24/11/2026): o PDF não está no espelho; pede ao robô pela caixa dos chamados (como a
        // DANFE) e espera os pedaços chegarem (até 2 minutos)
        const meta = ultimo.get(token)?.documentosDp?.find(d => d.id === id);
        if (meta?.sobPedido && !(meta.partes > 0)) {
          const pedido = ac.pedidoDeDocumentoDp(id);
          if (!pedido) return null;
          const banco = abrir();
          const ref = doc(banco, 'areasCliente', token, 'documentos', id);
          const inicio = new Date(Date.now() - 60_000).toISOString();
          await addDoc(collection(banco, 'areaClienteChamados'), { token, ...pedido, criadoEm: serverTimestamp() });
          const chegou = await new Promise<boolean>(ok => {
            const fim = setTimeout(() => { parar(); ok(false); }, 120_000);
            const parar = onSnapshot(ref, s => {
              const x = s.data();
              if (x && Number(x.partes) > 0) { clearTimeout(fim); parar(); ok(true); }
              else if (x && x.erro && String(x.atualizadoEm || '') >= inicio) { clearTimeout(fim); parar(); ok(false); }
            }, () => { clearTimeout(fim); parar(); ok(false); });
          });
          if (!chegou) return null;
        }
        const s = await getDocs(query(collection(abrir(), 'areasCliente', token, 'documentos'), where('de', '==', id)));
        const pedacos: PedacoDoPdf[] = s.docs.map(d => d.data()).filter(x => typeof x.base64 === 'string' && typeof x.n === 'number' && typeof x.total === 'number')
          .map(x => ({ base64: x.base64 as string, n: x.n as number, total: x.total as number }));
        const nome = ultimo.get(token)?.documentosDp?.find(d => d.id === id)?.nome || 'documento';
        const arquivo = juntarPedacosDoPdf(pedacos, mimeDoArquivo(nome));
        return arquivo ? { nome, arquivo } : null;
      } catch {
        return null;
      }
    },
  };
  if (!teste) return doBanco;

  // o link da empresa de teste: cada pedido vai para o exemplo (com o token dele), nada para o banco
  const t = teste;
  const de = (token: string): RepoAreaCliente => (deTeste.has(token) ? t.repo : doBanco);
  const tk = (token: string) => (deTeste.has(token) ? t.token : token);
  return {
    assinar: doBanco.assinar,
    enviar: (token, tipo, arquivos) => de(token).enviar(tk(token), tipo, arquivos),
    abrirChamado: (token, dados) => de(token).abrirChamado(tk(token), dados),
    responderChamado: (token, id, texto) => de(token).responderChamado(tk(token), id, texto),
    baixarGuia: (token, id) => de(token).baixarGuia(tk(token), id),
    baixarDocumento: (token, id) => de(token).baixarDocumento(tk(token), id),
    baixarComprovante: (token, id) => de(token).baixarComprovante(tk(token), id),
    baixarDocumentoDp: (token, id) => de(token).baixarDocumentoDp(tk(token), id),
    notasDoMes: (token, codigo, mes) => de(token).notasDoMes(tk(token), codigo, mes),
    extratoDoMes: (token, codigo, mes) => de(token).extratoDoMes(tk(token), codigo, mes),
    pedirDanfe: (token, chave) => de(token).pedirDanfe(tk(token), chave),
    confirmarRecebido: (token, id) => de(token).confirmarRecebido(tk(token), id),
    marcarSemMovimento: (token, comp) => de(token).marcarSemMovimento(tk(token), comp),
    aceitarPolitica: (token, versao) => de(token).aceitarPolitica(tk(token), versao),
    avaliarChamado: (token, id, nota, comentario) => de(token).avaliarChamado(tk(token), id, nota, comentario),
    // a senha vale só no banco (a empresa de teste nunca pede)
    entrar: (token, email, senha) => doBanco.entrar(token, email, senha),
    criarSenha: (token, email) => doBanco.criarSenha(token, email),
    sair: () => doBanco.sair(),
    acompanharConta: aoMudar => doBanco.acompanharConta(aoMudar),
    conferirCodigoDaSenha: codigo => doBanco.conferirCodigoDaSenha(codigo),
    gravarSenha: (codigo, senha) => doBanco.gravarSenha(codigo, senha),
  };
}
