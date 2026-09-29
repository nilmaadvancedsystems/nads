// Liga a sessão do Creditor ao repositório das contas (ver fonte.ts): o balancete da empresa e as
// contas salvas, sempre a versão mais nova (balancete atualizado na Conferência chega na hora).
import { creditor as cr } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { avisarErrosDoBanco, repoDoCreditor } from './fonte';

export interface ContasDaEmpresa {
  balancete: cr.BalanceteDaEmpresa;
  config: cr.ConfigCreditor;
  /** o balancete e as contas salvas já chegaram do banco */
  carregada: boolean;
  salvar: (c: cr.ConfigCreditor) => void;
}

export function useContasDaEmpresa(nome: string): ContasDaEmpresa {
  const repo = repoDoCreditor();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  const salvar = useCallback((c: cr.ConfigCreditor) => { if (repo.carregada(nome)) repo.salvarConfig(nome, c); }, [repo, nome]);
  return { balancete: repo.balancete(nome), config: repo.config(nome), carregada: repo.carregada(nome), salvar };
}
