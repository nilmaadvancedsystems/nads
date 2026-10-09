import { describe, expect, it } from 'vitest';
import { crc32, zipSemCompressao } from './zip';

describe('zipSemCompressao', () => {
  it('o CRC-32 conhecido', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
  it('os arquivos inteiros, na ordem, com o diretório no fim', () => {
    const a = new TextEncoder().encode('%PDF-1 guia A');
    const b = new TextEncoder().encode('%PDF-1 guia B, maior');
    const z = zipSemCompressao([{ nome: 'FGTS 09-2026 277.pdf', bytes: a }, { nome: 'FGTS 09-2026 380.pdf', bytes: b }]);
    const v = new DataView(z.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const fim = z.length - 22;
    expect(v.getUint32(fim, true)).toBe(0x06054b50);
    expect(v.getUint16(fim + 10, true)).toBe(2);
    // o primeiro arquivo começa logo depois do cabeçalho local (30 + o nome)
    const nome1 = 'FGTS 09-2026 277.pdf'.length;
    expect(new TextDecoder().decode(z.slice(30 + nome1, 30 + nome1 + a.length))).toBe('%PDF-1 guia A');
    expect(v.getUint32(14, true)).toBe(crc32(a));
  });
});
