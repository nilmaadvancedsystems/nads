// Os parcelamentos na Área do Cliente (plano do Acessórias, 18/11/2026, ficha parcelamentos).
import { describe, expect, it } from 'vitest';
import { parcelamentoDoDocumento } from '../entregas/parcelamentos';
import { parcelaDoMomento, parcelamentosDoCliente } from './parcelamentos';

const doc = (x: Record<string, unknown>) => parcelamentoDoDocumento('interno123', {
  clienteId: 'c1', orgao: 'pgfn', modalidade: 'Transação', numero: '123456', parcelas: 60, primeira: '2025-12', valorParcela: 350.5, dia: 20,
  status: 'ativo', aberto: true, pagas: {}, obs: 'cliente difícil', atualizadoPor: 'Heverton', ...x,
});
const hoje = new Date(2026, 10, 18);

describe('os parcelamentos na Área do Cliente', () => {
  it('a parcela do calendário, sem campo interno', () => {
    const r = parcelamentosDoCliente([doc({})], hoje);
    expect(r).toEqual([{ id: 'pgfn-1', orgao: 'PGFN · Dívida ativa', modalidade: 'Transação', parcela: 12, parcelas: 60, valorParcela: 350.5, vencimento: '20/11/2026' }]);
    expect(JSON.stringify(r)).not.toMatch(/difícil|Heverton|123456|interno123|c1/);
  });
  it('nunca atrasada: parcelas antigas sem marca não puxam a data para trás', () => {
    expect(parcelaDoMomento(doc({ pagas: {} }), hoje)).toEqual({ numero: 12, vencimento: '20/11/2026' });
  });
  it('a deste mês paga ou já vencida: mostra a do mês seguinte', () => {
    expect(parcelaDoMomento(doc({ pagas: { '2026-11': { em: 'x' } } }), hoje)).toEqual({ numero: 13, vencimento: '20/12/2026' });
    expect(parcelaDoMomento(doc({ dia: 10 }), hoje)).toEqual({ numero: 13, vencimento: '10/12/2026' });
  });
  it('a primeira ainda não chegou; a última já passou; o último dia útil', () => {
    expect(parcelaDoMomento(doc({ primeira: '2027-02' }), hoje)).toEqual({ numero: 1, vencimento: '20/02/2027' });
    expect(parcelaDoMomento(doc({ primeira: '2021-01', parcelas: 12 }), hoje)).toBeNull();
    expect(parcelaDoMomento(doc({ dia: 'util' }), hoje)).toEqual({ numero: 12, vencimento: '30/11/2026' });
  });
  it('só os ativos e abertos, o que vence primeiro antes', () => {
    const r = parcelamentosDoCliente([doc({}), doc({ orgao: 'simples', dia: 25, modalidade: '' }), doc({ status: 'quitado' }), doc({ orgao: 'pgfn', dia: 19 })], hoje);
    expect(r.map(x => x.id + ' ' + x.vencimento)).toEqual(['pgfn-2 19/11/2026', 'pgfn-1 20/11/2026', 'simples-1 25/11/2026']);
  });
});
