// A logo da empresa na Área do Cliente (12/11/2026).
import { describe, expect, it } from 'vitest';
import { erroDaLogo, erroDoArquivoDeLogo, MAIOR_LOGO } from './logo';

describe('a logo da empresa', () => {
  it('aceita o data URL de PNG, JPG ou WebP dentro do tamanho', () => {
    expect(erroDaLogo('data:image/png;base64,iVBORw0KGgo=')).toBe('');
    expect(erroDaLogo('data:image/webp;base64,UklGRg==')).toBe('');
  });

  it('recusa o vazio, o SVG, o que não é imagem e o grande demais', () => {
    expect(erroDaLogo('')).toMatch(/Escolha/);
    expect(erroDaLogo('data:image/svg+xml;base64,PHN2Zz4=')).toMatch(/PNG, JPG ou WebP/);
    expect(erroDaLogo('data:text/html;base64,PGI+')).toMatch(/PNG, JPG ou WebP/);
    expect(erroDaLogo('data:image/png;base64,' + 'A'.repeat(MAIOR_LOGO))).toMatch(/grande demais/);
    expect(erroDaLogo(42)).toMatch(/Escolha/);
  });

  it('o arquivo escolhido: imagem comum até 10 MB; o SVG com o motivo', () => {
    expect(erroDoArquivoDeLogo('image/jpeg', 2_000_000)).toBe('');
    expect(erroDoArquivoDeLogo('image/svg+xml', 1000)).toMatch(/SVG/);
    expect(erroDoArquivoDeLogo('application/pdf', 1000)).toMatch(/imagem/);
    expect(erroDoArquivoDeLogo('image/png', 11 * 1024 * 1024)).toMatch(/10 MB/);
  });
});
