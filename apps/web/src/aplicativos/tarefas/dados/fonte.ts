// De onde vêm os dados da Tarefas (VITE_FONTE):
//   "banco"    → o Firestore da Conferência, coleção `tarefas` (ver tarefas.firestore.ts), com a lista
//                de empresas do escritório; o check automático lê o que o Extrator guardou no banco;
//   "exemplos" → a lista de empresas do escritório com andamentos inventados (concluídas, em andamento,
//                paradas), neste navegador; nada vai para o banco. O check lê o Extrator de exemplo.
// O repositório é criado uma vez, quando alguém abre a Tarefas.
import { empresas, extrator, tarefas } from '@nads/core';
import { arquivosDoExtratorNoBanco, criarRepoTarefasFirestore, type RepoTarefasFirestore } from './tarefas.firestore';

export const noBanco = import.meta.env.VITE_FONTE === 'banco';

let repo: tarefas.RepoTarefas | null = null;

export function repoDaTarefas(): tarefas.RepoTarefas {
  if (!repo) repo = noBanco ? criarRepoTarefasFirestore(empresas.EMPRESAS) : tarefas.criarRepoTarefasMemoria({ empresas: empresas.EMPRESAS });
  return repo;
}

/** Os erros do banco (salvar/ler) vão para o toast da tela. */
export function avisarErrosDoBanco(r: tarefas.RepoTarefas, aviso: (mensagem: string) => void): void {
  if (noBanco) (r as RepoTarefasFirestore).definirAviso(aviso);
}

/** O que o Extrator guardou da empresa (para o check automático das etapas que dependem dele). */
export async function arquivosDoExtrator(nome: string): Promise<extrator.ArquivoImportado[]> {
  if (noBanco) return arquivosDoExtratorNoBanco(nome);
  // exemplos: o Extrator de exemplo guarda neste navegador; lê de novo a cada conferência
  return extrator.criarRepoExtratorMemoria({ exemplos: true }).obter(nome)?.arquivos || [];
}
