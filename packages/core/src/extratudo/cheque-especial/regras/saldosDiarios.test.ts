import { describe, expect, it } from 'vitest';
import { saldosDeFechamento } from './saldosDiarios';

const cols = { linhaCabecalho: 1, colData: 0, colSaldo: 2 };

describe('saldosDeFechamento', () => {
  it('última linha da mesma data vence e sai em ordem de data', () => {
    const linhas: unknown[][] = [
      ['Relatório'],
      ['Data', 'Histórico', 'Saldo'],
      ['06/01/2026', 'a', '10,00 C'],
      ['05/01/2026', 'b', '1,00 C'],
      ['05/01/2026', 'c', '2,00 D'],
      ['06/01/2026', 'd', '3,00 D'],
    ];
    const dias = saldosDeFechamento(linhas, cols, false);
    expect(dias).toEqual([
      { data: new Date(2026, 0, 5), saldo: -2 },
      { data: new Date(2026, 0, 6), saldo: -3 },
    ]);
  });

  it('pula linhas vazias, sem data ou sem saldo', () => {
    const linhas: unknown[][] = [
      ['x'],
      ['Data', 'H', 'Saldo'],
      [],
      ['Total', null, 99],
      ['05/01/2026', null, null],
      [new Date(2026, 0, 7, 12), null, -5],
    ];
    expect(saldosDeFechamento(linhas, cols, false)).toEqual([{ data: new Date(2026, 0, 7), saldo: -5 }]);
    expect(saldosDeFechamento(linhas, cols, true)).toEqual([{ data: new Date(2026, 0, 7), saldo: 5 }]);
  });

  it('linhas acima do cabeçalho são ignoradas', () => {
    const linhas: unknown[][] = [['05/01/2026', null, -1], ['Data', null, 'Saldo']];
    expect(saldosDeFechamento(linhas, cols, false)).toEqual([]);
  });
});
