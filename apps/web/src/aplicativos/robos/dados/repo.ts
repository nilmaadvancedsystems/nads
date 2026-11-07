// Liga o React aos dados da Central dos robôs (ver fonte.ts). Os ViewModels usam estes ganchos; nenhuma View importa o
// repositório.
import { useEffect, useSyncExternalStore } from 'react';
import type { robos } from '@nads/core';
import type { DocsDaCentral, PedidoDaTela } from './central';
import { repoDaCentral } from './fonte';

/** Tudo da central, ao vivo enquanto o site está aberto. */
export function useDocsDaCentral(): DocsDaCentral & { exemplos: boolean; pedir: (p: PedidoDaTela) => Promise<string> } {
  const repo = repoDaCentral();
  useEffect(() => repo.acompanhar(), [repo]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return { ...repo.docs(), exemplos: repo.exemplos, pedir: p => repo.pedir(p) };
}

/** O espelho do log de um robô, ao vivo enquanto `ligado` (a aba Registros aberta). */
export function useRegistrosDoRobo(robo: string, ligado: boolean): robos.RegistrosDoRobo {
  const repo = repoDaCentral();
  useEffect(() => (ligado && robo ? repo.acompanharRegistros(robo) : undefined), [repo, robo, ligado]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo.registros(robo);
}
