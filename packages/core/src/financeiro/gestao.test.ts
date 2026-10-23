import { describe, expect, it } from 'vitest';
import { caixaParaConferir, inadimplencia, previaDoReajuste, valorReajustado, type ContratoDeHonorario, type LancamentoDeCaixa, type RecebimentoDeHonorario } from './index';

const contrato = (id: string, valor: number, criadoEm = '2026-08-10T00:00:00Z', ativo = true): ContratoDeHonorario => ({ id, clienteId: '', codigo: id, nome: 'Cliente ' + id, cnpj: '', valor, ativo, criadoEm, criadoPor: '' });
const pago = (contratoId: string, competencia: string): RecebimentoDeHonorario => ({ id: contratoId + '_' + competencia, contratoId, competencia, valor: 1, recebidoEm: '', forma: 'pix', por: '', em: '' });
const l = (id: string, data: string, tipo: 'E' | 'S', valor: number, conta?: string): LancamentoDeCaixa => ({ id, data, descricao: 'h ' + id, valor, tipo, conta, origem: 'nads', criadoEm: '', criadoPor: '' });

describe('os devedores', () => {
  it('contam do primeiro recebimento (ou do contrato) até o mês passado', () => {
    const r = inadimplencia([contrato('a', 100), contrato('b', 200), contrato('c', 50, '2026-10-01T00:00:00Z'), contrato('d', 0), contrato('e', 9, '2026-08-01', false)],
      [pago('a', '2026-08'), pago('a', '2026-09'), pago('b', '2026-09')], '2026-10-22');
    expect(r.inicio).toBe('2026-08');
    expect(r.ate).toBe('2026-09');
    expect(r.devedores.map(d => [d.contrato.id, d.meses, d.total])).toEqual([['b', ['2026-08'], 200], ['c', ['2026-09'], 50]]);
    expect(r.total).toBe(250);
    expect(r.emDia).toBe(1);
  });
});

describe('o reajuste', () => {
  it('arredonda no centavo, no real ou de 5 em 5 (para cima)', () => {
    expect(valorReajustado(350, 4.5)).toBe(365.75);
    expect(valorReajustado(350, 4.5, 'real')).toBe(366);
    expect(valorReajustado(350, 4.5, 'cinco')).toBe(370);
    expect(valorReajustado(400, 0, 'cinco')).toBe(400);
  });
  it('a prévia só tem os ativos com valor', () => {
    expect(previaDoReajuste([contrato('b', 200), contrato('a', 0), contrato('c', 100, '', false)], 10).map(x => [x.contrato.id, x.atual, x.novo])).toEqual([['b', 200, 220]]);
  });
});

describe('a conciliação', () => {
  it('o caixa no formato da conferência (centavos, saída negativa)', () => {
    expect(caixaParaConferir([l('1', '2026-10-05', 'S', 12.3), l('2', '2026-11-01', 'E', 1)], '2026-10-01', '2026-10-31'))
      .toEqual([{ id: 'caixa:1', idArquivo: 'caixa', lado: 'sistema', data: '2026-10-05', valor: -1230, historico: 'h 1' }]);
  });
});
