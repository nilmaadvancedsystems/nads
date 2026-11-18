// A Tela de Insights (plano do Acessórias, 18/11/2026, ficha tela-de-insights).
import { describe, expect, it } from 'vitest';
import { tarefas as t } from '@nads/core';
import { criarInsightsMemoria } from '../../dados/insights';
import { idadeDosNumeros } from './useInsights';

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
