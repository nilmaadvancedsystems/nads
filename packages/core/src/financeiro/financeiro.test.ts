import { describe, expect, it } from 'vitest';
import { arvoreDoPlano, conferirLancamento, periodoPronto, planoEmLinhas, resumoDoPeriodo, saldoAte, totalDasCedulas, type ContaDoPlano, type LancamentoDeCaixa } from './index';

const l = (id: string, data: string, tipo: 'E' | 'S', valor: number): LancamentoDeCaixa => ({ id, data, descricao: 'x ' + id, valor, tipo, origem: 'nads', criadoEm: '', criadoPor: '' });
const caixa = [l('2', '2026-10-05', 'E', 100.1), l('1', '2026-10-05', 'S', 30.2), l('3', '2026-09-30', 'E', 500), l('10', '2026-10-05', 'E', 1), l('4', '2026-11-01', 'S', 9)];

describe('o caixa', () => {
  it('saldoAte soma só o que é estritamente anterior', () => {
    expect(saldoAte(caixa, '2026-10-05')).toBe(500);
    expect(saldoAte(caixa, '2026-10-06')).toBe(570.9);
    expect(saldoAte(caixa, '2026-01-01')).toBe(0);
  });
  it('resumoDoPeriodo traz saldos, totais e as linhas por data e id', () => {
    const r = resumoDoPeriodo(caixa, '2026-10-01', '2026-10-31');
    expect(r.saldoInicial).toBe(500);
    expect(r.entradas).toBe(101.1);
    expect(r.saidas).toBe(30.2);
    expect(r.saldoFinal).toBe(570.9);
    expect(r.lancamentos.map(x => x.id)).toEqual(['1', '2', '10']);
  });
  it('os períodos prontos', () => {
    expect(periodoPronto('este-mes', '2026-10-19')).toEqual({ de: '2026-10-01', ate: '2026-10-19' });
    expect(periodoPronto('mes-passado', '2026-10-19')).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(periodoPronto('mes-passado', '2026-01-10')).toEqual({ de: '2025-12-01', ate: '2025-12-31' });
    expect(periodoPronto('este-ano', '2026-10-19')).toEqual({ de: '2026-01-01', ate: '2026-10-19' });
  });
});

describe('a contagem de cédulas', () => {
  it('soma quantidade vezes valor, sem erro de centavos', () => {
    expect(totalDasCedulas({ '200': 1, '50': 2, '0.1': 3, '0.05': 1, '0.01': 4 })).toBe(300.39);
    expect(totalDasCedulas({})).toBe(0);
    expect(totalDasCedulas({ '100': -2, '10': Number.NaN, '5': 2.9 })).toBe(10);
  });
});

const c = (id: string, codigo: string, pai: string | null): ContaDoPlano => ({ id, codigo, descricao: 'Conta ' + codigo, tipo: 'RECEITA', nivel: codigo.split('.').length, pai, ativo: true, movimentavel: true });
describe('o plano de contas', () => {
  const plano = [c('c', '4.1.10', 'b'), c('b', '4.1', 'a'), c('a', '4', null), c('d', '4.1.2', 'b'), c('e', '5', null), c('f', '9.9', 'inexistente')];
  it('monta a árvore com os filhos por código (4.1.2 antes de 4.1.10)', () => {
    const arv = arvoreDoPlano(plano);
    expect(arv.map(n => n.conta.codigo)).toEqual(['4', '5', '9.9']);
    expect(arv[0].filhos[0].filhos.map(n => n.conta.codigo)).toEqual(['4.1.2', '4.1.10']);
  });
  it('em linhas, com a fundura', () => {
    expect(planoEmLinhas(plano).map(x => x.fundo + x.conta.codigo)).toEqual(['04', '14.1', '24.1.2', '24.1.10', '05', '09.9']);
  });
});

describe('conferirLancamento', () => {
  const ok = { data: '2026-10-19', descricao: 'Troco', valor: 10, tipo: 'E' as const };
  it('aceita o certo', () => expect(conferirLancamento(ok)).toEqual([]));
  it('pega data, descrição, valor e tipo', () => {
    expect(conferirLancamento({ ...ok, data: '2026-02-30' })).toHaveLength(1);
    expect(conferirLancamento({ ...ok, descricao: ' a ' })).toHaveLength(1);
    expect(conferirLancamento({ ...ok, valor: 0 })).toHaveLength(1);
    expect(conferirLancamento({ ...ok, valor: Number.NaN })).toHaveLength(1);
    expect(conferirLancamento({ ...ok, tipo: 'X' as 'E' })).toHaveLength(1);
    expect(conferirLancamento({ data: '', descricao: '', valor: -1, tipo: 'E' })).toHaveLength(3);
  });
});
