// Liga o React aos dados da Central dos robôs (ver fonte.ts). Os ViewModels usam estes ganchos; nenhuma View importa o
// repositório.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { robos } from '@nads/core';
import type { ClienteDaTela, DocsDaCentral, FilaDaTela, PedidoDaTela } from './central';
import { repoDaCentral, repoDosAjustes } from './fonte';

/** As configurações da central (ver dados/ajustes.ts): só os ViewModels chamam. */
export const ajustesDaCentral = repoDosAjustes;

/** Tudo da central, ao vivo enquanto o site está aberto. */
export function useDocsDaCentral(): DocsDaCentral & { exemplos: boolean; pedir: (p: PedidoDaTela) => Promise<string> } {
  const repo = repoDaCentral();
  useEffect(() => repo.acompanhar(), [repo]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return { ...repo.docs(), exemplos: repo.exemplos, pedir: p => repo.pedir(p) };
}

/** A fila de um robô pedido a pedido, ao vivo enquanto a aba Fila está aberta. */
export function useFilaDoRobo(robo: string): FilaDaTela {
  const repo = repoDaCentral();
  useEffect(() => repo.acompanharFila(robo), [repo, robo]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo.fila(robo);
}

/** Os clientes ativos, para escolher (lidos do banco na primeira vez que se abre, se `ligado`). */
export function useClientesDaCentral(ligado: boolean): ClienteDaTela[] {
  const repo = repoDaCentral();
  const [lista, setLista] = useState<ClienteDaTela[]>([]);
  useEffect(() => {
    if (!ligado) return undefined;
    let vivo = true;
    repo.clientes().then(c => { if (vivo) setLista(c); }).catch(() => { /* sem o cadastro: digita o código */ });
    return () => { vivo = false; };
  }, [repo, ligado]);
  return lista;
}

/** O espelho do log de um robô, ao vivo enquanto `ligado` (a aba Registros aberta). */
export function useRegistrosDoRobo(robo: string, ligado: boolean): robos.RegistrosDoRobo {
  const repo = repoDaCentral();
  useEffect(() => (ligado && robo ? repo.acompanharRegistros(robo) : undefined), [repo, robo, ligado]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return repo.registros(robo);
}
