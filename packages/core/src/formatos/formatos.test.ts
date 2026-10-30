import { describe, expect, it } from 'vitest';
import { brl, comp, dataOrdem, diaEmBrasilia, lancComZeros, lancN, mascaraDocumento, num, numeroDigitado } from './index';

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

  it('o valor digitado num campo de reais (o ponto sozinho com 1 ou 2 casas é decimal)', () => {
    expect(numeroDigitado('1234.56')).toBe(1234.56);
    expect(numeroDigitado('1234.5')).toBe(1234.5);
    expect(numeroDigitado('1.234,56')).toBe(1234.56);
    expect(numeroDigitado('1.234')).toBe(1234);
    expect(numeroDigitado('1.234.567')).toBe(1234567);
    expect(numeroDigitado('1234,5')).toBe(1234.5);
    expect(numeroDigitado('R$ 10')).toBe(10);
    expect(numeroDigitado(' ')).toBeNull();
    expect(numeroDigitado('abc')).toBeNull();
  });
  it('o dia em Brasília (o ISO é UTC: depois das 21h não vira o dia seguinte)', () => {
    expect(diaEmBrasilia('2026-10-30T01:30:00.000Z')).toBe('2026-10-29');
    expect(diaEmBrasilia(new Date('2026-10-30T03:00:00.000Z'))).toBe('2026-10-30');
    expect(diaEmBrasilia('2026-09-15')).toBe('2026-09-15');
    expect(diaEmBrasilia('')).toBe('');
    expect(diaEmBrasilia('não é data')).toBe('');
  });
});
