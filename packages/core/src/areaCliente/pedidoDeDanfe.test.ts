// A DANFE pelo relatório do dia da Área do Cliente (12/11/2026).
import { describe, expect, it } from 'vitest';
import { chaveDeNota, chaveDoPedidoDeDanfe, idDaDanfe, partesDaChave, pedidoDeDanfe } from './pedidoDeDanfe';

// UF 31, out/2026, CNPJ 11.222.333/0001-81, modelo 55, série 001, número 000001842
const CHAVE = '31' + '2610' + '11222333000181' + '55' + '001' + '000001842' + '1' + '12345678' + '9';

describe('o pedido da DANFE', () => {
  it('a chave de NF-e ou NFC-e: 44 números, modelo 55 ou 65', () => {
    expect(CHAVE).toHaveLength(44);
    expect(chaveDeNota(CHAVE.replace(/(\d{4})/g, '$1 '))).toBe(CHAVE);
    expect(chaveDeNota(CHAVE.slice(0, 20) + '57' + CHAVE.slice(22))).toBe('');
    expect(chaveDeNota('123')).toBe('');
  });

  it('o site manda um pedido de documento marcado, e o robô acha a chave nele', () => {
    const p = pedidoDeDanfe(CHAVE);
    expect(p).toEqual({ tipo: 'documento', titulo: 'DANFE', texto: 'danfe:' + CHAVE });
    expect(chaveDoPedidoDeDanfe(p)).toBe(CHAVE);
    // o chamado comum não é pedido de DANFE
    expect(chaveDoPedidoDeDanfe({ tipo: 'documento', titulo: 'Certidão', texto: 'danfe:' + CHAVE })).toBe('');
    expect(chaveDoPedidoDeDanfe({ tipo: 'duvida', titulo: 'DANFE', texto: 'danfe:' + CHAVE })).toBe('');
    expect(chaveDoPedidoDeDanfe({ tipo: 'documento', titulo: 'DANFE', texto: 'me manda a danfe' })).toBe('');
    expect(pedidoDeDanfe('abc')).toBeNull();
  });

  it('o CNPJ do emitente, o mês, o modelo e o número pela chave; o id no espelho', () => {
    expect(partesDaChave(CHAVE)).toEqual({ cnpj: '11222333000181', competencia: '2026-10', modelo: '55', numero: '1842' });
    expect(idDaDanfe(CHAVE)).toBe('danfe-' + CHAVE);
  });
});
