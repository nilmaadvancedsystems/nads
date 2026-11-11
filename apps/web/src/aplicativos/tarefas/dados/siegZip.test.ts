import { describe, expect, it } from 'vitest';
import { nomeDoZip, rotuloDoBotao, zipNoFormato } from './siegZip';

// um .zip "guardado" (sem compressão), como o robô monta (robo/sieg-xmls.js zipDe), para conferir o que sai
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  return (c ^ 0xffffffff) >>> 0;
}
function zip(arquivos: [string, string][]) {
  const enc = new TextEncoder();
  const partes: number[] = [], dir: number[] = [];
  const n16 = (a: number[], v: number) => a.push(v & 0xff, (v >>> 8) & 0xff);
  const n32 = (a: number[], v: number) => a.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);
  for (const [n, t] of arquivos) {
    const nome = enc.encode(n), dados = enc.encode(t), crc = crc32(dados), pos = partes.length;
    n32(partes, 0x04034b50); n16(partes, 20); n16(partes, 0x0800); n16(partes, 0); n32(partes, 0); n32(partes, crc); n32(partes, dados.length); n32(partes, dados.length); n16(partes, nome.length); n16(partes, 0);
    partes.push(...nome, ...dados);
    n32(dir, 0x02014b50); n16(dir, 20); n16(dir, 20); n16(dir, 0x0800); n16(dir, 0); n32(dir, 0); n32(dir, crc); n32(dir, dados.length); n32(dir, dados.length); n16(dir, nome.length); n16(dir, 0); n16(dir, 0); n16(dir, 0); n16(dir, 0); n32(dir, 0); n32(dir, pos);
    dir.push(...nome);
  }
  const fim: number[] = [];
  n32(fim, 0x06054b50); n16(fim, 0); n16(fim, 0); n16(fim, arquivos.length); n16(fim, arquivos.length); n32(fim, dir.length); n32(fim, partes.length); n16(fim, 0);
  return new Uint8Array([...partes, ...dir, ...fim]);
}
/** lê de volta um .zip guardado: [nome, texto, o CRC confere] de cada arquivo, pelo cabeçalho de cada um */
function abrir(b: Uint8Array) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const dec = new TextDecoder();
  const saida: [string, string, boolean][] = [];
  let i = 0;
  while (i + 30 <= b.length && dv.getUint32(i, true) === 0x04034b50) {
    const tam = dv.getUint32(i + 18, true), n = dv.getUint16(i + 26, true), e = dv.getUint16(i + 28, true);
    const dados = b.subarray(i + 30 + n + e, i + 30 + n + e + tam);
    saida.push([dec.decode(b.subarray(i + 30, i + 30 + n)), dec.decode(dados), crc32(dados) === dv.getUint32(i + 14, true)]);
    i += 30 + n + e + tam;
  }
  return saida;
}

const ORIGINAL = zip([
  ['3126-nfe.xml', '<nfeProc/>'],
  ['3126-evento-110111-1.xml', '<procEventoNFe/>'],
  ['PDF/3126 - FORNECEDOR ÁGUA.pdf', '%PDF-1.4 a'],
  ['PDF/nfse-1-9.pdf', '%PDF-1.4 b'],
]);

describe('o .zip do Baixar do SIEG no formato escolhido', () => {
  it('XML: sem a pasta PDF/', () => {
    const r = zipNoFormato(ORIGINAL, 'xml');
    expect(r.arquivos).toBe(2);
    expect(abrir(r.bytes)).toEqual([['3126-nfe.xml', '<nfeProc/>', true], ['3126-evento-110111-1.xml', '<procEventoNFe/>', true]]);
  });
  it('PDF: só os PDFs, soltos (sem o "PDF/" no nome), com acento', () => {
    const r = zipNoFormato(ORIGINAL, 'pdf');
    expect(r.arquivos).toBe(2);
    expect(abrir(r.bytes)).toEqual([['3126 - FORNECEDOR ÁGUA.pdf', '%PDF-1.4 a', true], ['nfse-1-9.pdf', '%PDF-1.4 b', true]]);
  });
  it('o .zip refeito é lido de novo pelo índice (outro filtro em cima dele)', () => {
    const so = zipNoFormato(zipNoFormato(ORIGINAL, 'xml').bytes, 'ambos');
    expect(so.arquivos).toBe(2);
  });
  it('XML e PDF: os bytes como vieram', () => {
    const r = zipNoFormato(ORIGINAL, 'ambos');
    expect(r.bytes).toBe(ORIGINAL);
    expect(r.arquivos).toBe(4);
  });
  it('sem PDF no .zip (pedido antigo): nenhum arquivo', () => {
    expect(zipNoFormato(zip([['a-nfe.xml', '<x/>']]), 'pdf').arquivos).toBe(0);
  });
  it('o que não é .zip dá erro', () => {
    expect(() => zipNoFormato(new TextEncoder().encode('<html>login</html>'), 'xml')).toThrow('não é um .zip');
  });
  it('o nome e o botão', () => {
    expect(nomeDoZip('SIEG 2026-10 - FITO.zip', 'pdf')).toBe('SIEG 2026-10 - FITO (PDFs).zip');
    expect(nomeDoZip('SIEG 2026-10 - FITO.zip', 'xml')).toBe('SIEG 2026-10 - FITO (XMLs).zip');
    expect(nomeDoZip('SIEG 2026-10 - FITO.zip', 'ambos')).toBe('SIEG 2026-10 - FITO.zip');
    expect([rotuloDoBotao('xml'), rotuloDoBotao('pdf'), rotuloDoBotao('ambos')]).toEqual(['Baixar XMLs do SIEG', 'Baixar PDFs do SIEG', 'Baixar XMLs e PDFs do SIEG']);
  });
});
