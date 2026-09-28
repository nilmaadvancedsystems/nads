import { describe, expect, it } from 'vitest';
import { chaveMes, chaveMesDaData, compararMeses, contarMeses, slugMeses } from './meses';

const d = (dia: number, mes: number, ano = 2026) => ({ data: new Date(ano, mes - 1, dia) });

describe('meses', () => {
  it('conta por mês em ordem cronológica', () => {
    expect(contarMeses([d(1, 8), d(5, 7), d(9, 7), d(1, 12, 2025)])).toEqual([
      { mes: 12, ano: 2025, qtd: 1 }, { mes: 7, ano: 2026, qtd: 2 }, { mes: 8, ano: 2026, qtd: 1 },
    ]);
    expect(contarMeses([])).toEqual([]);
  });

  it('chaves sem zero à esquerda', () => {
    expect(chaveMes({ mes: 7, ano: 2026 })).toBe('2026-7');
    expect(chaveMesDaData('05/07/2026')).toBe('2026-7');
    expect(chaveMesDaData('05/11/2026')).toBe('2026-11');
  });

  it('slug dos meses (mais de 4 resume)', () => {
    expect(slugMeses([{ mes: 7, ano: 2026 }])).toBe('2026-07');
    expect(slugMeses([1, 2, 3, 4, 5, 6].map(mes => ({ mes, ano: 2026 })))).toBe('2026-01_2026-02_2026-03_2026-04_e-mais-2');
    expect(slugMeses([])).toBe('');
  });

  it('compara meses do cartão com os das vendas', () => {
    const jul = { mes: 7, ano: 2026 }, ago = { mes: 8, ano: 2026 }, set = { mes: 9, ano: 2026 };
    expect(compararMeses([jul, ago], [set, jul])).toEqual({ extras: [set], comuns: [jul], excluidos: [ago] });
    expect(compararMeses([jul], [jul])).toEqual({ extras: [], comuns: [jul], excluidos: [] });
    expect(compararMeses([jul], [set])).toEqual({ extras: [set], comuns: [], excluidos: [jul] });
  });
});
