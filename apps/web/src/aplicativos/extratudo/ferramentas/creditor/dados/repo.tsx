// Liga a sessão do Creditor aos repositórios (ver fonte.ts): o balancete da empresa, as contas salvas e
// os clientes aprendidos, sempre a versão mais nova (balancete atualizado na Conferência chega na hora);
// e o Drive, de onde vem o relatório da competência.
import { creditor as cr } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { avisarErrosDoBanco, driveDoCreditor, repoDoCreditor } from './fonte';

export interface ContasDaEmpresa {
  balancete: cr.BalanceteDaEmpresa;
  config: cr.ConfigCreditor;
  clientes: cr.ClientesAprendidos;
  /** o balancete, as contas salvas e os clientes já chegaram do banco */
  carregada: boolean;
  salvar: (c: cr.ConfigCreditor) => void;
  salvarClientes: (c: cr.ClientesAprendidos) => void;
}

export function useContasDaEmpresa(nome: string): ContasDaEmpresa {
  const repo = repoDoCreditor();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  const salvar = useCallback((c: cr.ConfigCreditor) => { if (repo.carregada(nome)) repo.salvarConfig(nome, c); }, [repo, nome]);
  const salvarClientes = useCallback((c: cr.ClientesAprendidos) => { if (repo.carregada(nome)) repo.salvarClientes(nome, c); }, [repo, nome]);
  return { balancete: repo.balancete(nome), config: repo.config(nome), clientes: repo.clientes(nome), carregada: repo.carregada(nome), salvar, salvarClientes };
}

/** O Drive (login do Entregas, mapa da pasta e download), com o acesso sempre atualizado. */
export function useDrive(): { drive: cr.RepoDrive; acesso: cr.AcessoDrive } {
  const drive = driveDoCreditor();
  useSyncExternalStore(drive.assinar, drive.versao, drive.versao);
  return { drive, acesso: drive.acesso() };
}
