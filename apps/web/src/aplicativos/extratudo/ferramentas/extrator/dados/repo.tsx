// Liga o React ao repositório do Extrator (ver fonte.ts). Os ViewModels usam estes hooks;
// nenhuma View importa o repositório.
import { extrator, type creditor } from '@nads/core';
import { driveDoExtrator } from './fonte';
import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from 'react';

type Repo = extrator.RepoExtrator;
type Empresa = extrator.EmpresaExtrator;

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

/** A empresa guardada (ou uma vazia), sempre a versão mais nova. */
export function useEmpresa(nome: string): Empresa {
  const repo = useRepo();
  useVersaoDoRepo();
  return repo.obter(nome) || extrator.empresaNova(nome);
}

/** Aplica uma ação (função pura do core: empresa → empresa nova) e guarda. */
export function useAplicar(nome: string) {
  const repo = useRepo();
  return useCallback((acao: (e: Empresa) => Empresa): Empresa => {
    const e = repo.obter(nome) || extrator.empresaNova(nome);
    if (!repo.carregada(nome)) return e; // antes de a empresa chegar do banco, nunca grava
    const nova = acao(e);
    if (nova !== e) repo.salvar(nova);
    return nova;
  }, [repo, nome]);
}

/** O Drive do escritório (login do Entregas, mapa da pasta, cópia e link temporário), sempre atualizado. */
export function useDrive(): { drive: creditor.RepoDrive; acesso: creditor.AcessoDrive } {
  const drive = driveDoExtrator();
  useSyncExternalStore(drive.assinar, drive.versao, drive.versao);
  return { drive, acesso: drive.acesso() };
}
