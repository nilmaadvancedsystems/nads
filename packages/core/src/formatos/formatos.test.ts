import { describe, expect, it } from 'vitest';
import { brl, comp, dataOrdem, lancComZeros, lancN, mascaraDocumento, num } from './index';

describe('formatos', () => {
  it('lê número brasileiro de planilha', () => {
    expect(num('1.234,56')).toBe(1234.56);
    expect(num('(1.234,56)')).toBe(-1234.56);
    expect(num('1.234,56 D')).toBe(1234.56);
    expect(num('abc')).toBeNull();
  });
  it('competência e ordem de data', () => {
    expect(comp('05/03/2026')).toBe('2026-03');
    expect(dataOrdem('05/03/2026')).toBe(20260305);
  });
  it('lançamento com e sem zeros', () => {
    expect(lancN('00182')).toBe('182');
    expect(lancComZeros('182', '00006')).toBe('00182');
  });
  it('valor pt-BR', () => {
    expect(brl(1234.5)).toBe('1.234,50');
  });
});

describe('máscara do CNPJ/CPF enquanto digita (20/10/2026)', () => {
  it('CPF até 11 números, CNPJ de 12 a 14', () => {
    expect(mascaraDocumento('')).toBe('');
    expect(mascaraDocumento('1234')).toBe('123.4');
    expect(mascaraDocumento('11144477735')).toBe('111.444.777-35');
    expect(mascaraDocumento('119394880001')).toBe('11.939.488/0001');
    expect(mascaraDocumento('01.939.488/0001-80x9')).toBe('01.939.488/0001-80');
  });
});
