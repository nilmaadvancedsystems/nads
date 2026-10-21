// Liga o React ao resumo diário da saúde do banco (ver fonte.ts). Os ViewModels usam este gancho; nenhuma View importa o
// repositório. Os outros ganchos (o painel do robô, a saúde do robô, os feedbacks) são os da Tarefas (tarefas/dados/repo.tsx).
import { useEffect, useSyncExternalStore } from 'react';
import { repoDaSaudeDoBanco } from './fonte';
import type { DocsDaSaudeDoBanco } from './saudeBanco';

/** O resumo diário da saúde do banco: lê enquanto a tela está aberta. */
export function useResumoDoBanco(): DocsDaSaudeDoBanco & { exemplos: boolean } {
  const repo = repoDaSaudeDoBanco();
  useEffect(() => repo.acompanhar(), [repo]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return { ...repo.docs(), exemplos: repo.exemplos };
}
