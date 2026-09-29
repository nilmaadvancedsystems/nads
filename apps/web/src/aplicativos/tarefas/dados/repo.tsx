// Liga o React ao repositório da Tarefas (ver fonte.ts). Os ViewModels usam estes hooks; nenhuma
// View importa o repositório.
import type { tarefas, usuarios } from '@nads/core';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';

type Repo = tarefas.RepoTarefas;

const Ctx = createContext<Repo | null>(null);

export function RepoProvider({ repo, children }: { repo: Repo; children: ReactNode }) {
  return <Ctx.Provider value={repo}>{children}</Ctx.Provider>;
}

export function useRepo(): Repo {
  const r = useContext(Ctx);
  if (!r) throw new Error('useRepo fora do RepoProvider');
  return r;
}

/** Redesenha a cada mudança no repositório. */
export function useVersaoDoRepo(): number {
  const repo = useRepo();
  return useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
}

/** As execuções da competência (e se já chegaram do banco), sempre as mais novas. */
export function useExecucoes(competencia: string, departamento: usuarios.Departamento) {
  const repo = useRepo();
  useVersaoDoRepo();
  return { execucoes: repo.execucoes(competencia, departamento), carregada: repo.carregada(competencia, departamento) };
}
