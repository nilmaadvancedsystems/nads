// A trava do Extratudo (29/10/2026): o login com a conta do Entregas (projeto entregas-2e5e2), igual ao da
// Tarefas (tarefas/dados/entregas.firestore.ts):
//   - Firebase Auth do Entregas (e-mail/senha; o nome vira "nome@nilma.local", como lá);
//   - usuarios/{uid}: SÓ LEITURA do próprio documento (nome, papéis, cargo, ativo).
// É o mesmo app 'entregas' do Drive e do Cadastro (drive.firestore.ts): quem entra aqui já entra no Drive também.
// Dentro do Entregas (iframe) não há trava: a pessoa já entrou lá, e o Entregas confere o módulo (ver trava.ts).
import { usuarios } from '@nads/core';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import type { EstadoDaPorta, PortaDaTrava } from '../../../comum/trava/useTrava';
import { appDoEntregas } from './drive.firestore';

/** O banco do Entregas com as mesmas opções da Tarefas (que pode abrir depois, no mesmo site). */
function bancoDoEntregas(): Firestore {
  const app = appDoEntregas();
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app); // já aberto nesta página
  }
}

export function criarSessaoEntregas(): PortaDaTrava {
  const auth = getAuth(appDoEntregas());
  const db = bancoDoEntregas();
  let estado: EstadoDaPorta = { pronta: false, usuario: null, aviso: '' };
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudar = (e: EstadoDaPorta) => { estado = e; ver++; for (const f of ouvintes) f(); };

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
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
  };
}
