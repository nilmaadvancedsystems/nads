import { describe, expect, it } from 'vitest';
import { caixaPorMes, saldoDeHoje, totaisPorConta, ultimosMeses, type ContaDoPlano, type LancamentoDeCaixa } from './index';

const l = (id: string, data: string, tipo: 'E' | 'S', valor: number, conta?: string): LancamentoDeCaixa => ({ id, data, descricao: 'x', valor, tipo, conta, origem: 'nads', criadoEm: '', criadoPor: '' });
const conta = (id: string, codigo: string, descricao: string): ContaDoPlano => ({ id, codigo, descricao, tipo: 'DESPESA', nivel: 3, pai: null, ativo: true, movimentavel: true });

describe('o painel do Financeiro', () => {
  it('os últimos meses atravessam o ano', () => {
    expect(ultimosMeses('2026-02-10', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(ultimosMeses('2026-10-22')).toHaveLength(12);
  });
  it('soma entradas, saídas e resultado por mês, sem erro de vírgula', () => {
    const r = caixaPorMes([l('1', '2026-09-03', 'E', 0.1), l('2', '2026-09-30', 'E', 0.2), l('3', '2026-09-10', 'S', 0.05), l('4', '2026-08-01', 'E', 9)], ['2026-09', '2026-10']);
    expect(r).toEqual([{ mes: '2026-09', entradas: 0.3, saidas: 0.05, resultado: 0.25 }, { mes: '2026-10', entradas: 0, saidas: 0, resultado: 0 }]);
  });
  it('os totais por conta, com Sem conta e Outras contas', () => {
    const contas = new Map([['a', conta('a', '5.1', 'Aluguel')], ['b', conta('b', '5.2', 'Luz')], ['c', conta('c', '5.3', 'Água')]]);
    const lanc = [l('1', '2026-10-01', 'S', 50, 'a'), l('2', '2026-10-02', 'S', 30, 'b'), l('3', '2026-10-03', 'S', 15, 'c'), l('4', '2026-10-04', 'S', 5), l('5', '2026-10-04', 'E', 999, 'a'), l('6', '2026-11-01', 'S', 1, 'a')];
    const r = totaisPorConta(lanc, 'S', '2026-10-01', '2026-10-31', contas, 3);
    expect(r.map(x => [x.rotulo, x.total, x.pct])).toEqual([['5.1 Aluguel', 50, 50], ['5.2 Luz', 30, 30], ['Outras contas', 20, 20]]);
    expect(totaisPorConta(lanc, 'S', '2026-10-01', '2026-10-31', contas).at(-1)?.rotulo).toBe('Sem conta');
  });
  it('o saldo de hoje conta o dia de hoje', () => {
    expect(saldoDeHoje([l('1', '2026-10-22', 'E', 10), l('2', '2026-10-01', 'S', 3), l('3', '2026-10-23', 'E', 100)], '2026-10-22')).toBe(7);
  });
});
