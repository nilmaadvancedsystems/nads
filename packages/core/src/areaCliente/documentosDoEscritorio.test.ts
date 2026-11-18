// O acervo de documentos do escritório (plano do Acessórias, 17/11/2026, ficha documentos-do-escritorio).
import { describe, expect, it } from 'vitest';
import { areaDaSubpasta, idDoDocumentoDoEscritorio } from './documentosDoEscritorio';

describe('os documentos do escritório', () => {
  it('a área pela subpasta; o solto é societário', () => {
    expect(areaDaSubpasta('Contábil')).toBe('contabil');
    expect(areaDaSubpasta('FISCAL')).toBe('fiscal');
    expect(areaDaSubpasta('Departamento Pessoal')).toBe('dp');
    expect(areaDaSubpasta('DP')).toBe('dp');
    expect(areaDaSubpasta('SOCIETÁRIO')).toBe('societario');
    expect(areaDaSubpasta('')).toBe('societario');
    expect(areaDaSubpasta('outra coisa')).toBe('societario');
  });
  it('o id é estável, só com letras, números e traço, e muda com a empresa e o caminho', () => {
    const id = idDoDocumentoDoEscritorio(58, 'CONTÁBIL/Balanço 2025.pdf');
    expect(id).toBe(idDoDocumentoDoEscritorio(58, 'CONTÁBIL/Balanço 2025.pdf'));
    expect(id).toMatch(/^esc-58-contabil-balanco-2025-pdf-[a-z0-9]+$/);
    expect(id).not.toBe(idDoDocumentoDoEscritorio(59, 'CONTÁBIL/Balanço 2025.pdf'));
    expect(id).not.toBe(idDoDocumentoDoEscritorio(58, 'CONTÁBIL/Balanço 2024.pdf'));
    expect(idDoDocumentoDoEscritorio(58, 'x'.repeat(500) + '.pdf').length).toBeLessThanOrEqual(128);
  });
});
