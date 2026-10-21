import { describe, expect, it } from 'vitest';
import { competenciasDoPeriodo, faturamentoDasSaidas, linhasDoFaturamento, planilhaDoFaturamento, type SaidasSieg } from '.';

const saida = (codigo: string, competencia: string, ...valores: number[]): SaidasSieg => ({ codigo, competencia, em: '', series: valores.map((valor, i) => ({ modelo: '55', serie: String(i + 1), numeros: [], canceladas: [], valor })) });

describe('o faturamento dos clientes (Heverton, 20/10/2026)', () => {
  it('as competências do período', () => {
    expect(competenciasDoPeriodo('mes', '2026-09')).toEqual(['2026-09']);
    expect(competenciasDoPeriodo('ano', '2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(competenciasDoPeriodo('12m', '2026-09')).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(competenciasDoPeriodo('mes', 'x')).toEqual([]);
  });
  it('soma as séries do SIEG; sem o mês, vazio (nada inventado)', () => {
    expect(faturamentoDasSaidas(saida('1', '2026-09', 100.1, 200.2))).toBe(300.3);
    expect(faturamentoDasSaidas(null)).toBeNull();
  });
  it('as linhas: o total, a variação contra o mês anterior e a fonte', () => {
    const meses = new Map([['2026-08', new Map([['10', saida('10', '2026-08', 1000)]])], ['2026-09', new Map([['10', saida('10', '2026-09', 1500)], ['20', saida('20', '2026-09', 50)]])]]);
    const doMes = (c: string) => meses.get(c) || new Map();
    const l = linhasDoFaturamento([{ codigo: 10, nome: 'A', regime: 'Simples' }, { codigo: 20, nome: 'B', regime: 'MEI' }, { codigo: 30, nome: 'C', regime: 'Real' }], ['2026-08', '2026-09'], doMes);
    expect(l.map(x => x.codigo)).toEqual([10, 20, 30]);
    expect(l[0]).toMatchObject({ total: 2500, variacao: 50, fontes: ['SIEG · NF-e/NFC-e emitidas'] });
    expect(l[1]).toMatchObject({ total: 50, variacao: null });
    expect(l[2]).toMatchObject({ total: null, variacao: null, fontes: [] });
    expect(l[2].meses['2026-09']).toBeNull();
    expect(linhasDoFaturamento([{ codigo: 30, nome: 'C', regime: 'Real' }], ['2026-09'], doMes, true)).toEqual([]);
    const p = planilhaDoFaturamento(l.slice(0, 1), ['2026-08', '2026-09']);
    expect(p.cabecalho).toEqual(['Cód.', 'Cliente', 'Regime', 'ago/26', 'set/26', 'Total', 'Variação (%)', 'Fonte']);
    expect(p.linhas[0]).toEqual([10, 'A', 'Simples', 1000, 1500, 2500, 50, 'SIEG · NF-e/NFC-e emitidas']);
  });
});
