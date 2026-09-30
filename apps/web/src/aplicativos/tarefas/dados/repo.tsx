// Liga o React ao repositório da Tarefas (ver fonte.ts). Os ViewModels usam estes hooks; nenhuma
// View importa o repositório.
import type { empresas, tarefas, usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { repoDoCadastro } from './fonte';

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

export interface CadastroAoVivo {
  cadastro: empresas.cadastro.CadastroDaEmpresa;
  plano: empresas.cadastro.PlanoDeContas | null;
  /** o cadastro e o plano já chegaram do banco (antes disso, nada é gravado) */
  carregada: boolean;
  exemplos: boolean;
  salvar: (c: empresas.cadastro.CadastroDaEmpresa) => void;
  salvarPlano: (p: empresas.cadastro.PlanoDeContas, c: empresas.cadastro.CadastroDaEmpresa) => void;
}

/** O cadastro da empresa, sempre o mais novo (o que o Extrator ou o Creditor mudarem chega na hora). */
export function useCadastro(nome: string, codigo: number | null): CadastroAoVivo {
  const repo = repoDoCadastro();
  const { toast } = useRetorno();
  useEffect(() => { repo.definirAviso(toast); }, [repo, toast]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  const salvar = useCallback((c: empresas.cadastro.CadastroDaEmpresa) => repo.salvar(nome, c), [repo, nome]);
  const salvarPlano = useCallback((p: empresas.cadastro.PlanoDeContas, c: empresas.cadastro.CadastroDaEmpresa) => repo.salvarPlano(nome, p, c), [repo, nome]);
  return { cadastro: repo.cadastro(nome, codigo), plano: repo.plano(nome), carregada: repo.carregada(nome), exemplos: repo.exemplos, salvar, salvarPlano };
}
