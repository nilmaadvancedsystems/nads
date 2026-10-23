import { describe, expect, it } from 'vitest';
import { linhasDoExtrato, resumoDoExtrato, saldoFinalDoExtrato, saldosNoBanco, type ImportacaoDeExtrato } from './banco';

describe('o extrato do banco no Financeiro (23/10/2026)', () => {
  const lidas = [
    { data: '2026-10-01', valor: 150000, historico: 'PIX RECEBIDO  CLIENTE' },
    { data: '2026-10-02', valor: -2590, historico: 'TARIFA' },
    { data: '2026-10-02', valor: -2590, historico: 'TARIFA' },
    { data: '2026-10-03', valor: 0, historico: 'SALDO' },
  ];
  it('as linhas: o tipo pelo sinal, o valor em reais, sem as de valor zero, e o id fixo (as iguais pela ordem)', () => {
    const a = linhasDoExtrato(lidas, 'Sicoob', 'imp1');
    expect(a.map(l => [l.tipo, l.valor, l.historico])).toEqual([['E', 1500, 'PIX RECEBIDO CLIENTE'], ['S', 25.9, 'TARIFA'], ['S', 25.9, 'TARIFA']]);
    expect(new Set(a.map(l => l.id)).size).toBe(3);
    // importar de novo (outra importação) dá os mesmos ids: não duplica
    expect(linhasDoExtrato(lidas, 'Sicoob', 'imp2').map(l => l.id)).toEqual(a.map(l => l.id));
    // outro banco, outros ids
    expect(linhasDoExtrato(lidas, 'Efí', 'imp3')[0].id).not.toBe(a[0].id);
  });
  it('o resumo e o saldo final', () => {
    const a = linhasDoExtrato(lidas, 'Sicoob', 'imp1');
    expect(resumoDoExtrato(a)).toEqual({ de: '2026-10-01', ate: '2026-10-02', quantos: 3, entradas: 1500, saidas: 51.8 });
    expect(saldoFinalDoExtrato(lidas, 10000)).toBe(1548.2);
    expect(saldoFinalDoExtrato(lidas, undefined, [{ data: '2026-10-02', saldo: 99900 }, { data: '2026-10-01', saldo: 5 }])).toBe(999);
    expect(saldoFinalDoExtrato(lidas)).toBeUndefined();
  });
  it('o saldo de cada banco é o do extrato que vai mais longe', () => {
    const i = (id: string, banco: string, ate: string, saldoFinal?: number): ImportacaoDeExtrato =>
      ({ id, banco, arquivo: 'x', de: '2026-10-01', ate, quantos: 1, entradas: 0, saidas: 0, saldoFinal, importadoEm: '2026-10-23T10:00:00Z', importadoPor: 'X' });
    expect(saldosNoBanco([i('1', 'Sicoob', '2026-09-30', 10), i('2', 'Sicoob', '2026-10-20', 20), i('3', 'Efí', '2026-10-21'), i('4', 'Efí', '2026-10-10', 5)]))
      .toEqual([{ banco: 'Efí', saldo: 5, ate: '2026-10-10' }, { banco: 'Sicoob', saldo: 20, ate: '2026-10-20' }]);
  });
});
