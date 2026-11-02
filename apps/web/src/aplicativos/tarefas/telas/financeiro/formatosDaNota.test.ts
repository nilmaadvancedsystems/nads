import { describe, expect, it } from 'vitest';
import { valorDigitado } from './formatosDaNota';

describe('o valor digitado no Financeiro', () => {
  it('com vírgula: a vírgula é o decimal e os pontos são do milhar', () => {
    expect(['420,00', '1.250,5', '12.000,00', 'R$ 1.234.567,89', '0,5'].map(valorDigitado)).toEqual([420, 1250.5, 12000, 1234567.89, 0.5]);
  });
  it('um ponto só, sem vírgula: com 3 dígitos depois é o milhar (30/10/2026: "1.500" virava 1,50)', () => {
    expect(['1.500', '12.000', 'R$ 250.000', '1.000'].map(valorDigitado)).toEqual([1500, 12000, 250000, 1000]);
  });
  it('um ponto só, sem vírgula: com 1 ou 2 dígitos depois é o decimal', () => {
    expect(['420.5', '420.50', '1.5', '0.99'].map(valorDigitado)).toEqual([420.5, 420.5, 1.5, 0.99]);
  });
  it('mais de um ponto, sem número, ou só o inteiro', () => {
    expect(['1.234.567', 'R$ 420', '', 'abc'].map(valorDigitado)).toEqual([1234567, 420, 0, 0]);
  });
});
