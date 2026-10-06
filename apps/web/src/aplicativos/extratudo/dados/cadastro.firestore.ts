// O Cadastro da empresa no banco, do jeito que o Extratudo usa: o Firestore do Entregas (projeto entregas-2e5e2,
// 30/09/2026), coleção `cadastro`, que a Tarefas (Cadastro) edita. Precisa do login do Entregas (o mesmo do
// Drive, em drive.firestore.ts): sem ele (ou com o Extratudo dentro da página do Entregas, que fala pela ponte),
// a leitura é negada e as ferramentas seguem como antes, sem gravar nada aqui.
//   cadastro/{slug(nome)}              → { nome, codigo, bancos?, contasPadrao?, historico, atualizadoEm }
//   cadastro/{slug(nome)}/plano/atual  → { contas, origem, arquivo?, importadoEm, por? }
// O Extrator lê e grava as contas bancárias ("Adicionar banco"); o Creditor lê o plano e grava as contas padrão.
// A lógica fica no core (empresas.cadastro.criarRepoCadastro); aqui é só a porta.
import type { empresas } from '@nads/core';
import { getAuth } from 'firebase/auth';
import { collection, doc, getFirestore, initializeFirestore, onSnapshot, writeBatch as writeBatchBruto, type Firestore } from 'firebase/firestore';
import { appDoEntregas } from './drive.firestore';
import { guardarLote } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

function bancoDoEntregas(): Firestore {
  const app = appDoEntregas();
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app); // já aberto nesta página (o Drive)
  }
}

export function portaCadastroFirestore(): empresas.cadastro.PortaCadastro {
  const app = appDoEntregas();
  const auth = getAuth(app); // o login guardado neste computador volta antes da primeira leitura
  const db = bancoDoEntregas();
  /** ouve depois de saber quem está logado (sem isso, a primeira leitura sairia sem a conta) */
  const ouvir = (caminho: [string, ...string[]], chegou: (d: Record<string, unknown> | null) => void, falhou: (e: Error) => void) => {
    let parar = () => {};
    let parado = false;
    auth.authStateReady().then(() => {
      if (!parado) parar = onSnapshot(doc(db, ...caminho), s => chegou(s.exists() ? s.data() : null), falhou);
    }, falhou);
    return () => { parado = true; parar(); };
  };
  return {
    ouvirCadastro: (id, chegou, falhou) => ouvir(['cadastro', id], chegou, falhou),
    ouvirPlano: (id, chegou, falhou) => ouvir(['cadastro', id, 'plano', 'atual'], chegou, falhou),
    ouvirTodos(chegou, falhou) {
      let parar = () => {};
      let parado = false;
      auth.authStateReady().then(() => {
        if (!parado) parar = onSnapshot(collection(db, 'cadastro'), s => chegou(s.docs.map(d => ({ id: d.id, doc: d.data() }))), falhou);
      }, falhou);
      return () => { parado = true; parar(); };
    },
    async gravar(id, cadastro, plano) {
      const b = writeBatch(db);
      b.set(doc(db, 'cadastro', id), cadastro);
      if (plano) b.set(doc(db, 'cadastro', id, 'plano', 'atual'), plano);
      await b.commit();
    },
  };
}
