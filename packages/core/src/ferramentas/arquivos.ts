// O que as Ferramentas fazem com os arquivos em geral (12/11/2026): o zip do "Baixar todas", a ordem das listas
// (arrastar no Juntar), o tamanho em KB/MB, a economia do Comprimir e o texto que o OCR leu. Puro: sem tela, sem rede.

/** "2,3 MB", "480 KB". */
export function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/** O nome sem a extensão ("nota.fiscal.pdf" → "nota.fiscal"). */
export const semExtensao = (nome: string) => nome.replace(/\.[^.]+$/, '');

/** A lista com o item de `de` levado para `para` (arrastar na lista); fora da lista, a mesma lista. */
export function moverItem<T>(lista: readonly T[], de: number, para: number): T[] {
  if (de === para || de < 0 || para < 0 || de >= lista.length || para >= lista.length) return [...lista];
  const nova = [...lista];
  const [item] = nova.splice(de, 1);
  nova.splice(para, 0, item);
  return nova;
}

let tabelaDoCrc: Uint32Array | null = null;
/** O CRC-32 do zip. */
export function crc32(bytes: Uint8Array): number {
  if (!tabelaDoCrc) {
    tabelaDoCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelaDoCrc[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of bytes) crc = tabelaDoCrc[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Um zip com os arquivos (o "Baixar todas", no lugar de vários downloads seguidos que o navegador bloqueia). Nome
 * repetido ganha " (2)", " (3)"… antes da extensão. Os arquivos vão guardados sem comprimir (PNG, JPG e PDF já vêm
 * comprimidos) e o nome em UTF-8, com o acento (o zip do SheetJS tirava: "pág" virava "pag").
 */
export function zipDosArquivos(arquivos: readonly { nome: string; bytes: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const usados = new Set<string>();
  const locais: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  let posicao = 0;
  for (const a of arquivos) {
    const limpo = a.nome.replace(/[\\/:*?"<>|]/g, '-').trim() || 'arquivo';
    let nome = limpo;
    for (let n = 2; usados.has(nome.toLowerCase()); n++) nome = limpo.replace(/(\.[^.]+)?$/, m => ' (' + n + ')' + m);
    usados.add(nome.toLowerCase());
    const n = enc.encode(nome);
    const crc = crc32(a.bytes);
    // o cabeçalho local (30 bytes) e o do índice (46 bytes): versão 2.0, bit 11 = nome em UTF-8, método 0 = guardado
    const local = new Uint8Array(30 + n.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x0800, true);
    l.setUint32(14, crc, true); l.setUint32(18, a.bytes.length, true); l.setUint32(22, a.bytes.length, true);
    l.setUint16(26, n.length, true); local.set(n, 30);
    const central = new Uint8Array(46 + n.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, a.bytes.length, true); c.setUint32(24, a.bytes.length, true);
    c.setUint16(28, n.length, true); c.setUint32(42, posicao, true); central.set(n, 46);
    locais.push(local, a.bytes);
    centrais.push(central);
    posicao += local.length + a.bytes.length;
  }
  const tamanhoDoIndice = centrais.reduce((s, x) => s + x.length, 0);
  const fim = new Uint8Array(22);
  const f = new DataView(fim.buffer);
  f.setUint32(0, 0x06054b50, true); f.setUint16(8, arquivos.length, true); f.setUint16(10, arquivos.length, true);
  f.setUint32(12, tamanhoDoIndice, true); f.setUint32(16, posicao, true);
  const saida = new Uint8Array(posicao + tamanhoDoIndice + fim.length);
  let i = 0;
  for (const parte of [...locais, ...centrais, fim]) { saida.set(parte, i); i += parte.length; }
  return saida;
}

/** O nível do Comprimir: a escala do desenho (1 = 72 dpi) e a qualidade do JPG (0 a 1). */
export type NivelDeCompressao = 'leve' | 'media' | 'forte';
export const NIVEIS_DE_COMPRESSAO: Record<NivelDeCompressao, { rotulo: string; dica: string; escala: number; qualidade: number }> = {
  leve: { rotulo: 'Leve', dica: 'Quase a mesma nitidez; diminui menos.', escala: 2, qualidade: 0.75 },
  media: { rotulo: 'Média', dica: 'Boa para e-mail e portais: legível na tela e na impressão.', escala: 1.5, qualidade: 0.6 },
  forte: { rotulo: 'Forte', dica: 'O menor arquivo; letra miúda pode ficar borrada.', escala: 1.1, qualidade: 0.5 },
};

/** Quanto o arquivo diminuiu, em porcentagem inteira (0 quando não diminuiu). */
export function economia(antes: number, depois: number): number {
  if (antes <= 0 || depois >= antes) return 0;
  return Math.round((1 - depois / antes) * 100);
}

/** Um pedaço de texto com a posição (o que o OCR devolve, no formato do texto do PDF: y para cima). */
export interface PedacoDeTexto { texto: string; x: number; y: number; largura: number }

/**
 * O texto de uma página a partir dos pedaços com a posição: os pedaços na mesma altura (até `tolerancia` pontos) formam
 * uma linha, da esquerda para a direita; as linhas vão de cima para baixo.
 */
export function textoDosPedacos(pedacos: readonly PedacoDeTexto[], tolerancia = 4): string {
  const ordem = pedacos.filter(p => p.texto.trim()).slice().sort((a, b) => b.y - a.y);
  const linhas: { y: number; itens: PedacoDeTexto[] }[] = [];
  for (const p of ordem) {
    const linha = linhas.find(l => Math.abs(l.y - p.y) <= tolerancia);
    if (linha) linha.itens.push(p);
    else linhas.push({ y: p.y, itens: [p] });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map(l => l.itens.sort((a, b) => a.x - b.x).map(i => i.texto.trim()).join(' '))
    .join('\n');
}
