// O acervo de documentos do escritório (plano do Acessórias, 17/11/2026, ficha documentos-do-escritorio).
import { describe, expect, it } from 'vitest';
import { anexoDaMensagem, areaDaSubpasta, clienteDoEnvioAoCliente, linhaDoAnexo, erroDoEnvioAoCliente, idDoDocumentoDoEscritorio } from './documentosDoEscritorio';

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

describe('o arquivo que a equipe manda ao cliente (26/11/2026)', () => {
  it('a marca no campo cliente (a mesma que o robô lê)', () => {
    expect(clienteDoEnvioAoCliente('dp')).toBe('@area-do-cliente/dp');
  });
  it('o arquivo: vazio, grande demais e holerite não vão', () => {
    expect(erroDoEnvioAoCliente(null)).toBe('Escolha o arquivo.');
    expect(erroDoEnvioAoCliente({ nome: 'a.pdf', tamanho: 0 })).toMatch(/vazio/);
    expect(erroDoEnvioAoCliente({ nome: 'a.pdf', tamanho: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(erroDoEnvioAoCliente({ nome: 'Holerite 10-2026.pdf', tamanho: 10 })).toMatch(/Holerite/);
    expect(erroDoEnvioAoCliente({ nome: 'Certidão federal.pdf', tamanho: 10 })).toBe('');
  });
});

describe('o anexo na resposta da solicitação (26/11/2026)', () => {
  it('a linha vai e volta; sem a linha, sem anexo', () => {
    const t = 'Segue a certidão.' + String.fromCharCode(10, 10) + linhaDoAnexo('CND federal.pdf');
    expect(anexoDaMensagem(t)).toEqual({ texto: 'Segue a certidão.', nome: 'CND federal.pdf' });
    expect(anexoDaMensagem(linhaDoAnexo('a (2).pdf'))).toEqual({ texto: '', nome: 'a (2).pdf' });
    expect(anexoDaMensagem('só texto')).toEqual({ texto: 'só texto', nome: null });
  });
});
