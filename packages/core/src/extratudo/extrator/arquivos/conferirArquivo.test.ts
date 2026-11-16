import { describe, expect, it } from 'vitest';
import { MAIOR_ARQUIVO_PARA_IMPORTAR, problemaDoArquivoParaImportar as problema } from './leitura';

describe('o arquivo antes de ler (16/11/2026: o feedback do upload)', () => {
  it('o extrato aceita PDF, OFX e foto; o razão, planilha, CSV, PDF e OFX', () => {
    expect(problema('Extrato Itaú 10-2026.PDF', 120_000, 'banco')).toBe('');
    expect(problema('foto.jpeg', 900_000, 'banco')).toBe('');
    expect(problema('razao.xlsx', 50_000, 'sistema')).toBe('');
    expect(problema('razao.xlsx', 50_000, 'banco')).toMatch(/XLSX não serve aqui: mande o PDF/);
    expect(problema('extrato.jpg', 50_000, 'sistema')).toMatch(/JPG não serve aqui: mande o razão/);
    expect(problema('sem-extensao', 50_000, 'banco')).toMatch(/^Este arquivo não serve/);
  });
  it('o vazio e o enorme ficam de fora com o motivo', () => {
    expect(problema('extrato.pdf', 0, 'banco')).toMatch(/vazio/);
    expect(problema('extrato.pdf', MAIOR_ARQUIVO_PARA_IMPORTAR + 1, 'banco')).toMatch(/grande demais/);
  });
});
