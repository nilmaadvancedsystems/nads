// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights; frases do dono: "a Tela de Insights eu quero", "esses paineis so vao ser vistos por diretor e admin", "Todos os seis"): o resumo dos números do escritório
// (nadsInsights/atual, montado pelo robô do PC a cada 15 min). Nos exemplos, um resumo de mentira na memória.
import { tarefas as t } from '@nads/core';

export interface EstadoDosInsights { carregado: boolean; resumo: t.ResumoDosInsights | null; erro: string }

export interface RepoInsights {
  exemplos: boolean;
  /** pedir já começa a ouvir (um documento só) */
  estado(): EstadoDosInsights;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

export function criarInsightsMemoria(agora: () => Date = () => new Date()): RepoInsights {
  const resumo = t.resumoDeExemploDosInsights(new Date(agora().getTime() - 4 * 60 * 1000));
  return { exemplos: true, estado: () => ({ carregado: true, resumo, erro: '' }), assinar: () => () => {}, versao: () => 0 };
}
