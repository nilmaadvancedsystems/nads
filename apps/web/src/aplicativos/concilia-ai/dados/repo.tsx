// Liga o React ao repositório da Conferência (banco ou exemplos, ver fonte.ts).
// Os ViewModels usam estes hooks; nenhuma View importa o repositório.
import { conferencia } from '@nads/core';
import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';

type Repo = conferencia.RepoConferencia;
type Empresa = conferencia.Empresa;

const Ctx = createContext<Repo | null>(null);

export function RepoProvider({ repo, children }: { repo: Repo; children: ReactNode }) {
  return <Ctx.Provider value={repo}>{children}</Ctx.Provider>;
}

export function useRepo(): Repo {
  const r = useContext(Ctx);
  if (!r) throw new Error('useRepo fora do RepoProvider');
  return r;
}

/** Redesenha a cada gravação no repositório. */
export function useVersaoDoRepo(): number {
  const repo = useRepo();
  return useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
}

/** A empresa (ou null se nunca foi aberta), sempre a versão mais nova. */
export function useEmpresaGuardada(nome: string | null): Empresa | null {
  const repo = useRepo();
  useVersaoDoRepo();
  return nome ? repo.obter(nome) : null;
}

/**
 * Aplica uma ação (função pura do core: empresa → empresa nova) e guarda.
 * Devolve a empresa nova, para quem precisa dela na mesma hora.
 */
export function useAplicar(nome: string | null) {
  const repo = useRepo();
  return useCallback((acao: (e: Empresa) => Empresa): Empresa | null => {
    if (!nome || !repo.pronto()) return null; // antes de carregar o banco, nunca grava
    const e = repo.obter(nome) || conferencia.empresaNova(nome);
    const nova = acao(e);
    if (nova !== e || !repo.obter(nome)) repo.salvar(nova);
    return nova;
  }, [repo, nome]);
}
