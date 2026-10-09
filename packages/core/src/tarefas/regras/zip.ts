// O .zip de vários arquivos (09/10/2026: "baixar em lote" as guias do FGTS): os arquivos guardados como estão, sem
// comprimir (o PDF já vem comprimido). Puro: devolve os bytes do .zip; a tela baixa.
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Junta os arquivos num .zip (nomes em UTF-8, data 01/01/1980). */
export function zipSemCompressao(arquivos: readonly { nome: string; bytes: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const crc = crc32(a.bytes);
    const tam = a.bytes.length;
    const local = new Uint8Array(30 + nome.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true); l.setUint16(8, 0, true);
    l.setUint16(10, 0, true); l.setUint16(12, 0x21, true); l.setUint32(14, crc, true); l.setUint32(18, tam, true);
    l.setUint32(22, tam, true); l.setUint16(26, nome.length, true); l.setUint16(28, 0, true);
    local.set(nome, 30);
    const cen = new Uint8Array(46 + nome.length);
    const c = new DataView(cen.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true); c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true);
    c.setUint32(20, tam, true); c.setUint32(24, tam, true); c.setUint16(28, nome.length, true); c.setUint32(42, pos, true);
    cen.set(nome, 46);
    partes.push(local, a.bytes);
    central.push(cen);
    pos += local.length + tam;
  }
  const tamCentral = central.reduce((s, x) => s + x.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, arquivos.length, true); f.setUint16(10, arquivos.length, true);
  f.setUint32(12, tamCentral, true); f.setUint32(16, pos, true);
  const tudo = [...partes, ...central, fim];
  const saida = new Uint8Array(tudo.reduce((s, x) => s + x.length, 0));
  let o = 0;
  for (const x of tudo) { saida.set(x, o); o += x.length; }
  return saida;
}
