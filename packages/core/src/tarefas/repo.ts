// O que as telas da Tarefas podem pedir e gravar. A tela nunca sabe onde o dado mora.
// Implementações: repo.memoria.ts (exemplos, neste navegador) e, no site ligado ao banco,
// apps/web/src/aplicativos/tarefas/dados/tarefas.firestore.ts (Firestore da Conferência, coleção `tarefas`).
import type { EmpresaDoEscritorio } from '../empresas';
import { slug } from '../formatos';
import type { Departamento } from '../usuarios/tipos';
import type { Evento, Execucao } from './tipos';

export interface RepoTarefas {
  /** true = dados de exemplo */
  readonly exemplos: boolean;
  /** as empresas de "Minhas empresas" */
  listarEmpresas(): readonly EmpresaDoEscritorio[];
  /** as execuções da competência no departamento (pedir já começa a carregar) */
  execucoes(competencia: string, departamento: Departamento): Execucao[];
  /** a competência já chegou do banco? (antes disso, a tela mostra "Carregando…" e nada é gravado) */
  carregada(competencia: string, departamento: Departamento): boolean;
  /**
   * grava o estado novo e o evento que o causou (os eventos são só acrescentados, nunca mudados). antes: a execução de
   * onde a mudança partiu; com ela, só os campos que mudaram vão ao banco e o resto fica como estiver lá (30/10/2026:
   * gravar o documento inteiro a partir de uma cópia velha apagava o que outra gravação tinha posto)
   */
  gravar(execucao: Execucao, evento: Evento, antes?: Execucao): void;
  /** só o evento (ex.: começou uma etapa, o check automático não passou) */
  registrar(execucao: Execucao, evento: Evento): void;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
  /** volta os exemplos ao início (só no modo exemplos) */
  restaurarExemplos(): void;
}

/** O id do documento de uma execução: empresa, competência e departamento. */
export function idDaExecucao(empresa: string, competencia: string, departamento: Departamento): string {
  return slug(empresa) + '_' + competencia + '_' + departamento;
}
