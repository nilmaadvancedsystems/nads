// Liga o React ao repositório da Tarefas (ver fonte.ts). Os ViewModels usam estes hooks; nenhuma
// View importa o repositório.
import type { empresas, entregas, tarefas, usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { RepoAcesso } from './acesso';
import { bancosDoEntregas, gravarLeituraDoRobo, ouvirLeituraDoRobo, repoDeAcesso, repoDoCadastro, repoDoDrive, repoDoGmail } from './fonte';

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

/** As execuções de cada competência do período (a Etapa com vários meses), e se todas já chegaram do banco. */
export function useExecucoesDoPeriodo(competencias: string[], departamento: usuarios.Departamento) {
  const repo = useRepo();
  useVersaoDoRepo();
  const porMes = competencias.map(c => ({ competencia: c, execucoes: repo.execucoes(c, departamento), carregada: repo.carregada(c, departamento) }));
  return { porMes, carregada: porMes.every(m => m.carregada) };
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

/** Todos os cadastros (sem os planos), para a lista de empresas do Cadastro. */
export function useTodosOsCadastros() {
  const repo = repoDoCadastro();
  const { toast } = useRetorno();
  useEffect(() => { repo.definirAviso(toast); }, [repo, toast]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo.todos();
}

/** Os bancos que o Entregas já sabe de cada cliente (por código do ERP). */
export function useBancosDoEntregas(): { carregado: boolean; porCodigo: ReadonlyMap<number, empresas.cadastro.BancosDoEntregas> } {
  const [estado, setEstado] = useState<{ carregado: boolean; porCodigo: ReadonlyMap<number, empresas.cadastro.BancosDoEntregas> }>({ carregado: false, porCodigo: new Map() });
  useEffect(() => {
    let vale = true;
    void bancosDoEntregas().then(m => { if (vale) setEstado({ carregado: true, porCodigo: m }); });
    return () => { vale = false; };
  }, []);
  return estado;
}

/** O interruptor do robô que lê a agência e a conta dos extratos: ao vivo, e como mudar. */
export function useLeituraDoRobo(): { carregado: boolean; ligado: boolean; mudar: (ligado: boolean) => Promise<void> } {
  const [estado, setEstado] = useState<{ carregado: boolean; ligado: boolean }>({ carregado: false, ligado: true });
  useEffect(() => ouvirLeituraDoRobo(ligado => setEstado({ carregado: true, ligado }), () => setEstado(e => ({ ...e, carregado: true }))), []);
  return { ...estado, mudar: gravarLeituraDoRobo };
}

/** O Drive do escritório (o mapa ao vivo e os pedidos ao robô). */
export function useDriveDoEntregas(): entregas.RepoDriveDoEntregas {
  const repo = repoDoDrive();
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo;
}

/** A caixa do robô do Gmail, ao vivo. */
export function useGmailDoEntregas(): entregas.RepoGmailDoEntregas {
  const repo = repoDoGmail();
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo;
}

/** A proteção do login, a equipe e as configurações do nads, ao vivo. */
export function useAcesso(): RepoAcesso {
  const repo = repoDeAcesso();
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo;
}
