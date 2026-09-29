// O Drive do escritório pelo app Pendências (projeto Entregas, entregas-2e5e2). Liberado pelo Vitor
// em 2026-09-29, só para o Creditor puxar o relatório de liquidação da competência:
//   - login com o usuário do Entregas (Firebase Auth, e-mail/senha, o mesmo das Pendências);
//   - driveIndice/raiz e driveIndice/{pasta}/partes/{n}: SÓ LEITURA, o mapa das pastas que o robô
//     mantém (as regras do Entregas só deixam ler quem é admin ou do contábil);
//   - aberturasDrive: o pedido para o robô trazer a cópia do arquivo (modo "baixar"). O robô responde
//     no próprio pedido com um link temporário (30 min) do armazenamento do Entregas, e o arquivo é
//     baixado daquele link (o ÚNICO fetch do nads, travado em scripts/conexoes.mjs).
// Nada aqui grava no Drive nem em outra coleção do Entregas.
import { creditor as cr } from '@nads/core';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, getFirestore, onSnapshot } from 'firebase/firestore';

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

const semPermissao = (e: unknown) => /permission|insufficient/i.test(String((e as Error)?.message || e));

export function criarDriveFirestore(): cr.RepoDrive {
  const app = getApps().find(a => a.name === 'entregas') ?? initializeApp(CONFIG_ENTREGAS, 'entregas');
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
      const url = await this.link(id, nome, passo);
      passo?.('baixando a cópia');
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.arrayBuffer();
      } catch (e) {
        throw new Error('Não consegui baixar a cópia do Drive (' + ((e as Error)?.message || e) + '). Se o erro for de CORS, o armazenamento do Entregas precisa liberar este site.', { cause: e });
      }
    },

    /** Pede ao robô a cópia temporária (~30 min) e devolve o link dela — para ver, sem guardar. */
    async link(id, nome, passo) {
      const u = auth.currentUser;
      if (!u) throw new Error('Entre com o usuário do Entregas primeiro.');
      passo?.('pedindo ao robô do Drive');
      const ref = await addDoc(collection(db, 'aberturasDrive'), {
        status: 'pendente', fileId: id, nome, modo: 'baixar',
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

    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
  };
}
