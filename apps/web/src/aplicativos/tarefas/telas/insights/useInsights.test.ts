// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights).
import { describe, expect, it } from 'vitest';
import { tarefas as t } from '@nads/core';
import { criarInsightsMemoria } from '../../dados/insights';
import { idadeDosNumeros, telaDosInsights } from './useInsights';

describe('a Tela de Insights', () => {
  it('a idade dos números', () => {
    const agora = new Date(2026, 10, 18, 10, 0);
    expect(idadeDosNumeros(new Date(2026, 10, 18, 9, 59, 50).toISOString(), agora)).toBe('agora');
    expect(idadeDosNumeros(new Date(2026, 10, 18, 9, 45).toISOString(), agora)).toBe('há 15 min');
    expect(idadeDosNumeros(new Date(2026, 10, 18, 7, 0).toISOString(), agora)).toBe('há 3 h');
    expect(idadeDosNumeros('torto', agora)).toBe('');
  });
  it('os exemplos trazem os seis painéis', () => {
    const e = criarInsightsMemoria(() => new Date(2026, 10, 18, 10, 0)).estado();
    expect(e.carregado).toBe(true);
    expect(t.paineisDosInsights(e.resumo!).length).toBe(6);
  });
});

describe('o que a tela desenha', () => {
  it('os seis destaques, a equipe com anel, o funil das guias e a barra do DP', () => {
    const tela = telaDosInsights(t.resumoDeExemploDosInsights(new Date(2026, 10, 18)));
    expect(tela.competencia).toBe('outubro de 2026');
    expect(tela.destaques.map(d => d.id)).toEqual(['rotinas', 'dp', 'guias', 'nota', 'solicitacoes', 'tarefas']);
    expect(tela.destaques[0]).toMatchObject({ valor: '85%', detalhe: '144 de 170 empresas', tom: 'alerta' });
    expect(tela.equipe[0]).toMatchObject({ nome: 'Fernando', iniciais: 'F', pct: 57, texto: '12 de 21' });
    expect(tela.guias.funil.map(f => f.pct)).toEqual([100, 70, 37]);
    expect(tela.dp.segmentos.map(s => s.valor)).toEqual([96, 18, 3, 22]);
    expect(tela.tarefas).toEqual([{ nome: 'Fernando', iniciais: 'F', atrasadas: 3, pct: 100 }, { nome: 'Clara', iniciais: 'C', atrasadas: 2, pct: 67 }]);
  });
});
