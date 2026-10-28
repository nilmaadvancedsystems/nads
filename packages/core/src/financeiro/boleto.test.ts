import { describe, expect, it } from 'vitest';
import { lerBoleto, lerLinhaDigitavel, linhaFormatada, modulo10, vencimentoDoFator } from './index';

// as linhas foram montadas com os dígitos verificadores calculados à parte (o banco 001, fator 1234, R$ 150,75; o 237 sem
// fator nem valor; a arrecadação de segmento 3 com o módulo 10, R$ 234,56; a de segmento 5 com o módulo 11, R$ 99,90)
const DO_BANCO = '00190000090123456789701234567897512340000015075';
const SEM_VALOR = '23791234546789012345767890123457499990000000000';
const ARRECADACAO_10 = '836400000029345600010002000000001230456789012345';
const ARRECADACAO_11 = '858000000003999012345675890123456785901234567894';
const HOJE = '2026-10-28';

describe('ler o boleto', () => {
  it('o módulo 10', () => {
    expect(modulo10('001900000')).toBe(9);
    expect(modulo10('0123456789')).toBe(7);
  });
  it('o fator de vencimento, antes e depois da virada de 22/02/2025', () => {
    expect(vencimentoDoFator(1000, '2000-07-01')).toBe('2000-07-03');
    expect(vencimentoDoFator(9999, '2025-02-01')).toBe('2025-02-21');
    expect(vencimentoDoFator(1000, HOJE)).toBe('2025-02-22');
    expect(vencimentoDoFator(1234, HOJE)).toBe('2025-10-14');
    expect(vencimentoDoFator(1234, '2001-01-01')).toBe('2001-02-22');
    expect(vencimentoDoFator(0, HOJE)).toBe('');
  });
  it('a linha do banco: o valor, o vencimento e o código de barras', () => {
    expect(lerLinhaDigitavel(DO_BANCO, HOJE)).toEqual({
      tipo: 'bancario', linha: DO_BANCO, codigoDeBarras: '00195123400000150750000001234567890123456789', valor: 150.75, vencimento: '2025-10-14',
    });
    // o fator 9999 do ciclo antigo; valor zerado
    expect(lerLinhaDigitavel(SEM_VALOR, HOJE)).toMatchObject({ valor: null, vencimento: '2025-02-21' });
  });
  it('a linha com um dígito trocado não passa', () => {
    expect(lerLinhaDigitavel(DO_BANCO.slice(0, 40) + '9' + DO_BANCO.slice(41), HOJE)).toBeNull();
    expect(lerLinhaDigitavel(DO_BANCO.slice(0, 9) + '0' + DO_BANCO.slice(10), HOJE)).toBeNull();
    expect(lerLinhaDigitavel(ARRECADACAO_10.slice(0, 5) + '9' + ARRECADACAO_10.slice(6), HOJE)).toBeNull();
    expect(lerLinhaDigitavel('123', HOJE)).toBeNull();
  });
  it('a arrecadação, no módulo 10 e no 11: o valor, sem vencimento', () => {
    expect(lerLinhaDigitavel(ARRECADACAO_10, HOJE)).toEqual({
      tipo: 'arrecadacao', linha: ARRECADACAO_10, codigoDeBarras: '83640000002345600010000000000012345678901234', valor: 234.56, vencimento: null,
    });
    expect(lerLinhaDigitavel(ARRECADACAO_11, HOJE)).toMatchObject({ tipo: 'arrecadacao', valor: 99.9, vencimento: null });
  });
  it('acha a linha no texto do PDF, como vem impressa ou colada no meio de outros números', () => {
    const impressa = linhaFormatada(DO_BANCO);
    expect(impressa).toBe('00190.00009 01234.567897 01234.567897 5 12340000015075');
    expect(lerBoleto(`BANCO DO BRASIL 001-9 ${impressa} Local de pagamento: em qualquer banco`, HOJE)?.valor).toBe(150.75);
    expect(lerBoleto(`Conta de água ${linhaFormatada(ARRECADACAO_10)} Vencimento 10/11/2026`, HOJE)?.tipo).toBe('arrecadacao');
    expect(lerBoleto(`Linha: ${DO_BANCO}`, HOJE)?.linha).toBe(DO_BANCO);
    expect(lerBoleto(`Ref 12 ${DO_BANCO.slice(0, 20)} ${DO_BANCO.slice(20)} 99`, HOJE)?.linha).toBe(DO_BANCO);
    expect(lerBoleto('Nota fiscal 123 CNPJ 11.222.333/0001-81 valor R$ 10,00', HOJE)).toBeNull();
  });
  it('a linha formatada da arrecadação', () => {
    expect(linhaFormatada(ARRECADACAO_10)).toBe('83640000002-9 34560001000-2 00000000123-0 45678901234-5');
    expect(linhaFormatada('12')).toBe('');
  });
});
