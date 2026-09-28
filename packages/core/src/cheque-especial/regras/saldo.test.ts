import { describe, expect, it } from 'vitest';
import { arredondarCentavos, saldoDaCelula } from './saldo';

describe('arredondarCentavos', () => {
  it('arredonda e normaliza -0', () => {
    expect(arredondarCentavos(1.005 * 1000)).toBe(1005);
    expect(arredondarCentavos(10.456)).toBe(10.46);
    expect(Object.is(arredondarCentavos(-0.0000000000164), 0)).toBe(true);
    expect(Object.is(arredondarCentavos(-0), 0)).toBe(true);
  });
});

describe('saldoDaCelula', () => {
  it('vazio vira null', () => {
    expect(saldoDaCelula(null, true)).toBeNull();
    expect(saldoDaCelula(undefined, false)).toBeNull();
    expect(saldoDaCelula('', true)).toBeNull();
  });

  it('número: sinal mantido na convenção padrão e trocado com inverterCD', () => {
    expect(saldoDaCelula(-1234.567, false)).toBe(-1234.57);
    expect(saldoDaCelula(-1234.567, true)).toBe(1234.57);
    expect(saldoDaCelula(50, true)).toBe(-50);
    expect(Object.is(saldoDaCelula(-0.0000001, true), 0)).toBe(true);
  });

  it('texto com sufixo C/D (padrão: C +, D −)', () => {
    expect(saldoDaCelula('1.234,56 C', false)).toBe(1234.56);
    expect(saldoDaCelula('1.234,56 D', false)).toBe(-1234.56);
    expect(saldoDaCelula('1.234,56d', false)).toBe(-1234.56);
  });

  it('texto com sufixo C/D invertido (D +, C −)', () => {
    expect(saldoDaCelula('1.234,56 C', true)).toBe(-1234.56);
    expect(saldoDaCelula('1.234,56 D', true)).toBe(1234.56);
  });

  it('texto sem sufixo fica positivo, mesmo com "-" (igual ao original)', () => {
    expect(saldoDaCelula('-1.234,56', false)).toBe(1234.56);
    expect(saldoDaCelula('R$ 10,50', true)).toBe(10.5);
  });

  it('texto com ponto decimal perde o ponto (vira milhar), igual ao original', () => {
    expect(saldoDaCelula('1234.56', false)).toBe(123456);
  });

  it('texto sem dígitos vira 0 (não null), e lixo que não é número vira null', () => {
    expect(saldoDaCelula('abc', false)).toBe(0);
    expect(saldoDaCelula('1-2', false)).toBeNull();
  });
});
