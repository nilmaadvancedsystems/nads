// Liga o React ao repositório do Extrator (ver fonte.ts). Os ViewModels usam estes hooks;
// nenhuma View importa o repositório.
import { extrator, type creditor, type empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { repoDoCadastro } from '../../../dados/cadastro';
import { driveDoExtrator } from './fonte';
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';

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

/**
 * O cadastro da empresa (Tarefas › Cadastro): as contas bancárias viram as linhas de banco do Extrator.
 * Enquanto não chega do banco, `cadastro` é null (vale o de antes).
 */
export function useCadastroDaEmpresa(nome: string, codigo: number | null): {
  cadastro: empresas.cadastro.CadastroDaEmpresa | null;
  salvar: (c: empresas.cadastro.CadastroDaEmpresa) => void;
} {
  const cad = repoDoCadastro();
  const { toast } = useRetorno();
  useEffect(() => { cad.definirAviso(toast); }, [cad, toast]);
  useSyncExternalStore(cad.assinar, cad.versao, cad.versao);
  const salvar = useCallback((c: empresas.cadastro.CadastroDaEmpresa) => cad.salvar(nome, c), [cad, nome]);
  const cadastro = cad.cadastro(nome, codigo);
  return { cadastro: cad.carregada(nome) ? cadastro : null, salvar };
}
