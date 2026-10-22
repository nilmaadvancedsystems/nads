// Liga o React ao resumo diário da saúde do banco e ao acompanhamento do arquivador novo (ver fonte.ts). Os ViewModels
// usam estes ganchos; nenhuma View importa o repositório. Os outros ganchos (o painel do robô, a saúde do robô, os feedbacks) são os da Tarefas (tarefas/dados/repo.tsx).
import { useEffect, useSyncExternalStore } from 'react';
import type { DiaDoArquivador, DocsDoArquivadorNovo } from './arquivadorNovo';
import { repoDaSaudeDoBanco, repoDoArquivadorNovo } from './fonte';
import type { DocsDaSaudeDoBanco } from './saudeBanco';

/** O resumo diário da saúde do banco: lê enquanto a tela está aberta. */
export function useResumoDoBanco(): DocsDaSaudeDoBanco & { exemplos: boolean } {
  const repo = repoDaSaudeDoBanco();
  useEffect(() => repo.acompanhar(), [repo]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return { ...repo.docs(), exemplos: repo.exemplos };
}

/** O acompanhamento do arquivador novo, ao vivo enquanto a tela está aberta; dia(): o histórico de um dia (lido quando pedem). */
export function useArquivadorNovo(): DocsDoArquivadorNovo & { exemplos: boolean; dia: (dia: string) => DiaDoArquivador } {
  const repo = repoDoArquivadorNovo();
  useEffect(() => repo.acompanhar(), [repo]);
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  return { ...repo.docs(), exemplos: repo.exemplos, dia: (d: string) => repo.dia(d) };
}
