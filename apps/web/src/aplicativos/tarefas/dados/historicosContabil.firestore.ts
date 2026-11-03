// Os históricos do Contábil (Contábil › Configurações; valem para todas as empresas): um documento só no banco,
// extrator/escritorio/contabil/historicos, { <id do histórico>: texto ou código, atualizadoEm }. Mesmo padrão do Creditor
// (extratudo/dados/creditor.firestore.ts): ouvido em tempo real; nada é gravado antes de chegar do banco; grava só o que
// mudou; erro vai para o aviso da tela. Sem banco (modo desenvolvedor), fica na memória com os padrões.
import { tarefas as tf } from '@nads/core';
import { doc, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { bancoDaConferencia } from './extrator.firestore';
import { guardar, ligadoAoBanco } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const noBanco = ligadoAoBanco();

type Aviso = (mensagem: string) => void;

export interface RepoHistoricosContabil {
  /** os textos e códigos em uso (o padrão até chegar do banco) */
  modelos(): tf.ModelosDoHistorico;
  /** o documento já chegou do banco (só então se grava) */
  carregados(): boolean;
  salvar(m: tf.ModelosDoHistorico): void;
  assinar(f: () => void): () => void;
  versao(): number;
  definirAviso(fn: Aviso): void;
}

const DOC = ['extrator', 'escritorio', 'contabil', 'historicos'] as const;

let repo: RepoHistoricosContabil | null = null;

export function repoDoHistoricosContabil(): RepoHistoricosContabil {
  if (!repo) repo = noBanco ? criarRepoFirestore() : criarRepoMemoria();
  return repo;
}

const mesmos = (a: tf.ModelosDoHistorico, b: tf.ModelosDoHistorico) =>
  tf.HISTORICOS_DO_CONTABIL.every(h => a[h.id] === b[h.id]);

function criarRepoFirestore(): RepoHistoricosContabil {
  const db = bancoDaConferencia();
  let modelos: tf.ModelosDoHistorico = tf.MODELOS_PADRAO;
  let chegaram = false;
  let ver = 0;
  let avisar: Aviso = m => console.warn(m);
  const ouvintes = new Set<() => void>();
  const avisarTodos = () => { ver++; for (const f of ouvintes) f(); };

  onSnapshot(doc(db, ...DOC), s => {
    modelos = tf.modelosDoDocumento(s.exists() ? s.data() : null);
    chegaram = true;
    avisarTodos();
  }, err => avisar('Não consegui ler os históricos do Contábil na nuvem: ' + err.message));

  return {
    modelos: () => modelos,
    carregados: () => chegaram,
    salvar(m) {
      if (!chegaram || mesmos(modelos, m)) return; // antes de chegar do banco, nunca grava
      modelos = m;
      avisarTodos();
      setDoc(doc(db, ...DOC), { ...m, atualizadoEm: new Date().toISOString() })
        .catch((err: Error) => avisar('Não deu para salvar os históricos do Contábil na nuvem: ' + err.message));
    },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
    definirAviso(fn) { avisar = fn; },
  };
}

function criarRepoMemoria(): RepoHistoricosContabil {
  let modelos: tf.ModelosDoHistorico = tf.MODELOS_PADRAO;
  let ver = 0;
  const ouvintes = new Set<() => void>();
  return {
    modelos: () => modelos,
    carregados: () => true,
    salvar(m) { if (mesmos(modelos, m)) return; modelos = m; ver++; for (const f of ouvintes) f(); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
    definirAviso() { /* sem banco, nada a avisar */ },
  };
}
