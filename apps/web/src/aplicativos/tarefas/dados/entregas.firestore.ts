// A Tarefas no banco do Entregas (projeto entregas-2e5e2), pedido do escritório em 30/09/2026: o nads
// inteiro passa a gravar lá, com as contas de lá. Aqui ficam a conexão e o login:
//   - Firebase Auth do Entregas (e-mail/senha; o nome vira "nome@nilma.local", como lá);
//   - usuarios/{uid}: a leitura do próprio documento (nome, papéis, cargo, ativo) e, na Minha página (02/10/2026), a
//     troca do próprio nome (o dono pode) e da senha (Firebase Auth, pedindo a atual de novo).
// As tarefas ficam na coleção `rotinas` (tarefas.firestore.ts), que usa a mesma conexão.
// O app Firebase se chama 'entregas', o mesmo do Drive do Extratudo: no site com os dois, a sessão é uma só.
import { usuarios } from '@nads/core';
import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, EmailAuthProvider, getAuth, onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc, getFirestore, initializeFirestore, updateDoc, type Firestore } from 'firebase/firestore';

/** Configuração web pública do projeto do Entregas (a mesma das páginas de lá). */
const CONFIG_ENTREGAS = {
  apiKey: 'AIzaSyD6xg7XhX8dKTKmaYup4hRX5k9XFHEkb98',
  authDomain: 'entregas-2e5e2.firebaseapp.com',
  projectId: 'entregas-2e5e2',
  storageBucket: 'entregas-2e5e2.firebasestorage.app',
  messagingSenderId: '1009094556836',
  appId: '1:1009094556836:web:d3b6a9283e934db064fa31',
};

/** A sessão: `pronta` = já se sabe se tem alguém; `aviso` = por que a conta não entrou. */
export interface EstadoSessao { pronta: boolean; usuario: usuarios.Usuario | null; aviso: string }

export interface SessaoEntregas {
  estado(): EstadoSessao;
  entrar(login: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  /** troca a senha (pede a atual de novo, como o Entregas: o Firebase exige o login recente) */
  trocarSenha(atual: string, nova: string): Promise<void>;
  /** troca o nome (usuarios/{uid}.nome; o dono pode): vale já em toda a Tarefas */
  trocarNome(nome: string): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

const appDoEntregas = () => getApps().find(a => a.name === 'entregas') ?? initializeApp(CONFIG_ENTREGAS, 'entregas');

/** Quem está logado no Entregas agora (uid e e-mail vão nos pedidos ao robô; as regras conferem o uid). */
/** A hora do login atual (auth_time do token, em segundos): a chave da liberação do nads. */
export async function horaDoLogin(): Promise<string> {
  const u = getAuth(appDoEntregas()).currentUser;
  if (!u) return '';
  const t = await u.getIdTokenResult();
  return String(t.claims.auth_time || '');
}

export function contaDoEntregas(): { uid: string; email: string } | null {
  const u = getAuth(appDoEntregas()).currentUser;
  return u ? { uid: u.uid, email: u.email || '' } : null;
}

/** O banco do Entregas (a mesma conexão para o login e para as rotinas; campo undefined não vai). */
/**
 * Cria o login (e-mail/senha) de uma pessoa nova no Firebase Auth do Entregas e devolve o uid — como o "Criar acesso"
 * do Entregas (criarContaEquipe): numa instância à parte, que é descartada, porque criar no app principal trocaria a
 * sessão do admin pela da pessoa nova. O cadastro (usuarios/{uid}) quem grava é a sessão do admin (acesso.firestore.ts).
 */
export async function criarLoginNoEntregas(email: string, senha: string): Promise<string> {
  const app = initializeApp(CONFIG_ENTREGAS, 'secundario-' + Date.now());
  try {
    const auth = getAuth(app);
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await signOut(auth);
    return cred.user.uid;
  } catch (e) {
    const c = String((e as { code?: string })?.code || '');
    throw new Error(c === 'auth/email-already-in-use' ? 'Já existe um acesso com esse nome.' : c === 'auth/weak-password' ? 'A senha é fraca demais.' : 'Não consegui criar o login (' + (c || String(e)) + ').', { cause: e });
  } finally {
    await deleteApp(app).catch(() => undefined);
  }
}

export function bancoDoEntregas(): Firestore {
  const app = appDoEntregas();
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app); // já aberto nesta página
  }
}

export function criarSessaoEntregas(): SessaoEntregas {
  const auth = getAuth(appDoEntregas());
  const db = bancoDoEntregas();
  let estado: EstadoSessao = { pronta: false, usuario: null, aviso: '' };
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudar = (e: EstadoSessao) => { estado = e; ver++; for (const f of ouvintes) f(); };

  onAuthStateChanged(auth, async u => {
    if (!u) { mudar({ pronta: true, usuario: null, aviso: estado.aviso }); return; }
    try {
      const d = await getDoc(doc(db, 'usuarios', u.uid));
      const lido = d.exists() ? usuarios.lerUsuario(u.uid, d.data() as usuarios.DocUsuario) : null;
      // conta sem cadastro na equipe, ou desativada: não entra (o Entregas faz o mesmo)
      if (!lido || !lido.ativo || !lido.papeis.length) {
        await signOut(auth);
        mudar({ pronta: true, usuario: null, aviso: lido && !lido.ativo ? 'Esta conta está desativada.' : 'Esta conta não é da equipe.' });
        return;
      }
      mudar({ pronta: true, usuario: lido, aviso: '' });
    } catch (e) {
      mudar({ pronta: true, usuario: null, aviso: 'Não consegui ler o seu cadastro no Entregas (' + ((e as Error)?.message || e) + ').' });
    }
  });

  return {
    estado: () => estado,
    async entrar(login, senha) {
      mudar({ ...estado, aviso: '' });
      try {
        await signInWithEmailAndPassword(auth, usuarios.emailDoLogin(login), senha);
      } catch (e) {
        throw new Error(usuarios.mensagemDeErroDeLogin(String((e as { code?: string })?.code || '')), { cause: e });
      }
    },
    async sair() { await signOut(auth); },
    async trocarSenha(atual, nova) {
      const u = auth.currentUser;
      if (!u || !u.email) throw new Error('Sem login.');
      try {
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, atual));
      } catch (e) {
        const c = String((e as { code?: string })?.code || '');
        throw new Error(c === 'auth/wrong-password' || c === 'auth/invalid-credential' ? 'Senha atual incorreta.' : 'Não consegui conferir a senha atual (' + c + ').', { cause: e });
      }
      await updatePassword(u, nova);
    },
    async trocarNome(nome) {
      const u = auth.currentUser;
      if (!u || !estado.usuario) throw new Error('Sem login.');
      await updateDoc(doc(db, 'usuarios', u.uid), { nome });
      mudar({ ...estado, usuario: { ...estado.usuario, nome } });
    },
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
  };
}
