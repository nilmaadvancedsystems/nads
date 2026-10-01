// Repositório da Tarefas no banco: o Firestore do Entregas (projeto entregas-2e5e2), coleção `rotinas`
// (30/09/2026; antes era `tarefas` no banco da Conferência — no Entregas, `tarefas` é do tarefas.html antigo).
// Precisa do login do Entregas (entregas.firestore.ts): as regras de lá só deixam quem é da equipe.
//   rotinas/{empresa}_{competência}_{departamento}          → a execução (estado de cada etapa)
//   rotinas/{empresa}_{competência}_{departamento}/eventos   → o que aconteceu, com hora e pessoa
//                                                             (só acrescentado: é a base da produtividade)
// Lê também, sem gravar, os arquivos do Extrator (coleção `extrator`, ainda no banco da Conferência até o
// Extratudo mudar), para o check automático.
// Cuidados, os mesmos da Conferência e do Extratudo:
// - carrega só a competência pedida (uma consulta), não a coleção inteira;
// - nada é gravado antes de a competência chegar do banco;
// - se falhar, avisa 'Não deu para salvar … na nuvem: …';
// - a leitura negada (o login ainda chegando, ou a liberação do computador acabando de sair) tenta de novo sozinha
//   (1, 2, 4 e 8 s); só avisa se continuar, e uma vez só para todos os meses (não um aviso por mês).
import { extrator as x, formatos, tarefas as t, type empresas, type usuarios } from '@nads/core';
import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, initializeFirestore, onSnapshot, query, where, writeBatch, type Firestore } from 'firebase/firestore';
import { bancoDoEntregas } from './entregas.firestore';

/** Configuração web pública do projeto conferencia-nilma (a mesma da Conferência). */
const CONFIG_CONFERENCIA = {
  apiKey: 'AIzaSyAkYvoKljQFKJDiYvkpYHwFmjc2cpEl9Go',
  authDomain: 'conferencia-nilma.firebaseapp.com',
  projectId: 'conferencia-nilma',
  storageBucket: 'conferencia-nilma.firebasestorage.app',
  messagingSenderId: '1037380082378',
  appId: '1:1037380082378:web:c21407e582534572953233',
};

const COLECAO = 'rotinas';

type Aviso = (mensagem: string) => void;

export interface RepoTarefasFirestore extends t.RepoTarefas {
  definirAviso(fn: Aviso): void;
}

/** O banco da Conferência (se outro aplicativo já abriu nesta página, usa a mesma conexão). */
export function bancoDaConferencia(): Firestore {
  const app = getApps().find(a => a.name === 'conferencia') ?? initializeApp(CONFIG_CONFERENCIA, 'conferencia');
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
}

interface Carga { chegou: boolean; execucoes: Map<string, t.Execucao> }

/** As esperas antes de tentar de novo uma leitura negada (ms). */
const ESPERAS = [1000, 2000, 4000, 8000];

export function criarRepoTarefasFirestore(lista: readonly empresas.EmpresaDoEscritorio[]): RepoTarefasFirestore {
  const db = bancoDoEntregas();
  const cargas = new Map<string, Carga>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let avisar: Aviso = m => console.warn(m);
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  // os meses que não deu para ler, para um aviso só
  const naoLidos = new Map<string, string>();
  let avisoMarcado: ReturnType<typeof setTimeout> | null = null;
  const avisarNaoLidos = () => {
    if (avisoMarcado) return;
    avisoMarcado = setTimeout(() => {
      avisoMarcado = null;
      if (!naoLidos.size) return;
      const meses = [...naoLidos.keys()].sort().map(c => t.rotuloCompetencia(c));
      const motivo = [...naoLidos.values()][0];
      avisar('Não consegui ler as tarefas de ' + meses.join(', ') + ' na nuvem: ' + motivo);
      naoLidos.clear();
    }, 300);
  };

  function carregar(competencia: string, departamento: usuarios.Departamento): Carga {
    const k = competencia + '|' + departamento;
    const pronta = cargas.get(k);
    if (pronta) return pronta;
    const c: Carga = { chegou: false, execucoes: new Map() };
    cargas.set(k, c);
    const q = query(collection(db, COLECAO), where('competencia', '==', competencia), where('departamento', '==', departamento));
    const ouvir = (tentativa: number) => {
      onSnapshot(q, s => {
        c.execucoes = new Map(s.docs.map(d => [d.id, d.data() as t.Execucao]));
        c.chegou = true;
        naoLidos.delete(competencia);
        mudou();
      }, err => {
        // negada: o login pode ainda estar chegando (ou a liberação deste computador acabou de sair): tenta de novo
        if (tentativa < ESPERAS.length && /permission|insufficient|unauthenticated/i.test(err.message)) {
          setTimeout(() => ouvir(tentativa + 1), ESPERAS[tentativa]);
          return;
        }
        naoLidos.set(competencia, err.message);
        avisarNaoLidos();
      });
    };
    ouvir(0);
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

/** O que o Extrator guardou da empresa: os arquivos e os bancos adicionados (só leitura, para o check automático). */
export async function extratorNoBanco(nome: string): Promise<x.EmpresaExtrator> {
  const db = bancoDaConferencia();
  const id = formatos.slug(nome);
  const [d, s] = await Promise.all([getDoc(doc(db, 'extrator', id)), getDocs(collection(db, 'extrator', id, 'arquivos'))]);
  return x.empresaDoBanco(nome, (d.data() as Partial<x.DocEmpresaExtrator> | undefined) || null, s.docs.map(a => a.data() as x.ArquivoImportado));
}
