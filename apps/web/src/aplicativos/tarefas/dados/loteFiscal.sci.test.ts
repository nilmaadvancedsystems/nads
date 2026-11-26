import { describe, expect, it } from 'vitest';
import { fraseDoSciReport } from './loteFiscal';

describe('Enviar guias: a via SCI Report com a publicação ligada (24/11/2026)', () => {
  it('diz o que foi publicado e o que não foi, com o motivo', () => {
    expect(fraseDoSciReport(undefined)).toBe('');
    expect(fraseDoSciReport({ publicadas: 1, falhas: [], erro: '' })).toBe('publicada no SCI Report');
    expect(fraseDoSciReport({ publicadas: 2, falhas: [{ nome: 'DAS.pdf', erro: 'falta o código do relatório' }], erro: '' }))
      .toBe('2 publicadas no SCI Report; 1 não foi: DAS.pdf (falta o código do relatório)');
    expect(fraseDoSciReport({ publicadas: 0, falhas: [], erro: 'a SCI recusou os tokens' })).toBe('não foi ao SCI Report: a SCI recusou os tokens');
  });
});
