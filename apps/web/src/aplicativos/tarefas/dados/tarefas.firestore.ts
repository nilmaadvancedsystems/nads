// Repositório da Tarefas no banco: o MESMO Firestore da Conferência (projeto conferencia-nilma),
// coleção nova `tarefas` (regras abertas; nenhuma regra foi mudada).
//   tarefas/{empresa}_{competência}_{departamento}          → a execução (estado de cada etapa)
//   tarefas/{empresa}_{competência}_{departamento}/eventos   → o que aconteceu, com hora e pessoa
//                                                             (só acrescentado: é a base da produtividade)
// Lê também, sem gravar, os arquivos do Extrator (coleção `extrator`), para o check automático.
// Cuidados, os mesmos da Conferência e do Extratudo:
// - carrega só a competência pedida (uma consulta), não a coleção inteira;
// - nada é gravado antes de a competência chegar do banco;
// - se falhar, avisa 'Não deu para salvar … na nuvem: …'.
import { extrator as x, formatos, tarefas as t, type empresas, type usuarios } from '@nads/core';
import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, initializeFirestore, onSnapshot, query, where, writeBatch, type Firestore } from 'firebase/firestore';

/** Configuração web pública do projeto conferencia-nilma (a mesma da Conferência). */
const CONFIG_CONFERENCIA = {
  apiKey: 'AIzaSyAkYvoKljQFKJDiYvkpYHwFmjc2cpEl9Go',
  authDomain: 'conferencia-nilma.firebaseapp.com',
  projectId: 'conferencia-nilma',
  storageBucket: 'conferencia-nilma.firebasestorage.app',
  messagingSenderId: '1037380082378',
  appId: '1:1037380082378:web:c21407e582534572953233',
};

const COLECAO = 'tarefas';

type Aviso = (mensagem: string) => void;

export interface RepoTarefasFirestore extends t.RepoTarefas {
  definirAviso(fn: Aviso): void;
}

/** O banco da Conferência (se outro aplicativo já abriu nesta página, usa a mesma conexão). */
function bancoDaConferencia(): Firestore {
  const app = getApps().find(a => a.name === 'conferencia') ?? initializeApp(CONFIG_CONFERENCIA, 'conferencia');
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
}

interface Carga { chegou: boolean; execucoes: Map<string, t.Execucao> }

export function criarRepoTarefasFirestore(lista: readonly empresas.EmpresaDoEscritorio[]): RepoTarefasFirestore {
  const db = bancoDaConferencia();
  const cargas = new Map<string, Carga>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let avisar: Aviso = m => console.warn(m);
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  function carregar(competencia: string, departamento: usuarios.Departamento): Carga {
    const k = competencia + '|' + departamento;
    const pronta = cargas.get(k);
    if (pronta) return pronta;
    const c: Carga = { chegou: false, execucoes: new Map() };
    cargas.set(k, c);
    const q = query(collection(db, COLECAO), where('competencia', '==', competencia), where('departamento', '==', departamento));
    onSnapshot(q, s => {
      c.execucoes = new Map(s.docs.map(d => [d.id, d.data() as t.Execucao]));
      c.chegou = true;
      mudou();
    }, err => avisar('Não consegui ler as tarefas de ' + t.rotuloCompetencia(competencia) + ' na nuvem: ' + err.message));
    return c;
  }

  function lote(ex: t.Execucao, ev: t.Evento, comEstado: boolean) {
    const c = carregar(ex.competencia, ex.departamento);
    if (!c.chegou) return; // antes de a competência chegar do banco, nunca grava
    const id = t.idDaExecucao(ex.empresa, ex.competencia, ex.departamento);
    const b = writeBatch(db);
    if (comEstado) {
      c.execucoes.set(id, ex); // a tela já vê a mudança; o banco confirma pelo onSnapshot
      mudou();
      b.set(doc(db, COLECAO, id), { ...ex, atualizadoEm: new Date().toISOString() });
    }
    b.set(doc(collection(db, COLECAO, id, 'eventos')), ev);
    b.commit().catch((err: Error) => avisar('Não deu para salvar a tarefa de "' + ex.empresa + '" na nuvem: ' + err.message));
  }

  return {
    exemplos: false,
    listarEmpresas: () => lista,
    execucoes: (competencia, departamento) => [...carregar(competencia, departamento).execucoes.values()],
    carregada: (competencia, departamento) => carregar(competencia, departamento).chegou,
    gravar: (ex, ev) => lote(ex, ev, true),
    registrar: (ex, ev) => lote(ex, ev, false),
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
    restaurarExemplos() { /* só no modo exemplos */ },
    definirAviso(fn) { avisar = fn; },
  };
}

/** Os arquivos que o Extrator guardou da empresa (só leitura, para o check automático). */
export async function arquivosDoExtratorNoBanco(nome: string): Promise<x.ArquivoImportado[]> {
  const s = await getDocs(collection(bancoDaConferencia(), 'extrator', formatos.slug(nome), 'arquivos'));
  return s.docs.map(d => d.data() as x.ArquivoImportado);
}
