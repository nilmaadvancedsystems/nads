// As regras novas das Ferramentas (12/11/2026): as miniaturas (cortes e giros), imagem em PDF, juntar com imagem,
// numerar as páginas, o zip do "Baixar todas", a ordem da lista e o texto do OCR.
import { crc32, deflateSync } from 'node:zlib';
import { PDFDocument, degrees } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { itensDoPdf } from '../extratudo/extrator/arquivos/pdf';
import { crc32 as crcDoZip, economia, moverItem, tamanhoLegivel, textoDosPedacos, zipDosArquivos } from './arquivos';
import { formatoDaImagem } from './imagens';
import {
  A4, contarPaginas, cortesDosGrupos, editarPdf, gruposDoTexto, gruposPelosCortes, juntarArquivos, numerarPaginas,
  pdfDeImagens, posicaoNoRodape, textoDasPaginas, textoDoNumero, textoDosGrupos,
} from './pdf';

async function pdfCom(n: number, tamanho: [number, number] = [200, 300]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage(tamanho);
  return doc.save();
}

/** Um PNG cinza de largura × altura, montado na mão (assinatura, IHDR, IDAT e IEND). */
function png(largura: number, altura: number): Uint8Array {
  const pedaco = (tipo: string, dados: Buffer) => {
    const t = Buffer.from(tipo, 'ascii');
    const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, dados])) >>> 0);
    return Buffer.concat([tam, t, dados, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8 bits, tons de cinza
  const linhas = Buffer.alloc((largura + 1) * altura, 0x80);
  for (let y = 0; y < altura; y++) linhas[y * (largura + 1)] = 0; // o filtro de cada linha
  return new Uint8Array(Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr), pedaco('IDAT', deflateSync(linhas)), pedaco('IEND', Buffer.alloc(0)),
  ]));
}

describe('as páginas e os grupos em texto', () => {
  it('escreve as páginas no texto curto, juntando as seguidas', () => {
    expect(textoDasPaginas([0, 1, 2, 4])).toBe('1-3, 5');
    expect(textoDasPaginas([4, 0, 0, 1])).toBe('1-2, 5');
    expect(textoDasPaginas([])).toBe('');
  });

  it('lê e escreve os grupos do Separar', () => {
    expect(gruposDoTexto('1-3; 4-6', 6)).toEqual({ grupos: [[0, 1, 2], [3, 4, 5]] });
    expect(gruposDoTexto('  ', 6).erro).toContain('Escreva os grupos');
    expect(gruposDoTexto('1-3; 9', 6).erro).toContain('fora de 1 a 6');
    expect(textoDosGrupos([[0, 1, 2], [3], [4, 5]])).toBe('1-3; 4; 5-6');
  });

  it('os cortes das miniaturas viram grupos, e os grupos em sequência voltam a ser cortes', () => {
    expect(gruposPelosCortes(5, [])).toEqual([[0, 1, 2, 3, 4]]);
    expect(gruposPelosCortes(5, [3, 1, 3, 0, 9])).toEqual([[0], [1, 2], [3, 4]]);
    expect(cortesDosGrupos([[0], [1, 2], [3, 4]], 5)).toEqual([1, 3]);
    expect(cortesDosGrupos([[0, 1, 2, 3, 4]], 5)).toEqual([]);
    // fora de sequência, pulando ou faltando o fim: as miniaturas não conseguem mostrar como cortes
    expect(cortesDosGrupos([[2, 3], [0, 1]], 4)).toBeNull();
    expect(cortesDosGrupos([[0], [2, 3]], 4)).toBeNull();
    expect(cortesDosGrupos([[0, 1]], 4)).toBeNull();
  });
});

describe('girar e tirar pelas miniaturas', () => {
  it('gira cada página no seu giro, somando ao que ela já tem, e tira as marcadas', async () => {
    const doc = await PDFDocument.load(await pdfCom(4));
    doc.getPage(2).setRotation(degrees(90));
    const saida = await PDFDocument.load(await editarPdf(await doc.save(), { giros: [90, 0, 270, 180], tirar: [3] }));
    expect(saida.getPageCount()).toBe(3);
    expect(saida.getPages().map(p => p.getRotation().angle)).toEqual([90, 0, 0]);
  });

  it('não deixa tirar todas', async () => {
    await expect(editarPdf(await pdfCom(2), { tirar: [0, 1] })).rejects.toThrow('todas as páginas');
  });
});

describe('imagem em PDF e juntar com imagem', () => {
  it('reconhece PNG e JPG pelos bytes', () => {
    expect(formatoDaImagem(png(1, 1))).toBe('png');
    expect(formatoDaImagem(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(formatoDaImagem(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
  });

  it('uma página por imagem: no A4 em pé, no A4 deitado ou do tamanho da imagem', async () => {
    const doc = await PDFDocument.load(await pdfDeImagens([{ bytes: png(10, 20) }, { bytes: png(40, 20) }]));
    expect(doc.getPages().map(p => [Math.round(p.getWidth()), Math.round(p.getHeight())])).toEqual([
      [Math.round(A4[0]), Math.round(A4[1])], [Math.round(A4[1]), Math.round(A4[0])],
    ]);
    const doTamanho = await PDFDocument.load(await pdfDeImagens([{ bytes: png(40, 20) }], 'imagem'));
    expect([doTamanho.getPage(0).getWidth(), doTamanho.getPage(0).getHeight()]).toEqual([30, 15]);
    const exato = await PDFDocument.load(await pdfDeImagens([{ bytes: png(4, 4), tamanho: [100, 50] }]));
    expect([exato.getPage(0).getWidth(), exato.getPage(0).getHeight()]).toEqual([100, 50]);
  });

  it('recusa o que não é imagem e a lista vazia', async () => {
    await expect(pdfDeImagens([])).rejects.toThrow('ao menos uma imagem');
    await expect(pdfDeImagens([{ bytes: new Uint8Array([1, 2, 3]) }])).rejects.toThrow('não é PNG nem JPG');
  });

  it('junta PDF e imagem na ordem dada', async () => {
    const junto = await juntarArquivos([await pdfCom(2), png(10, 10), await pdfCom(1)]);
    expect(await contarPaginas(junto)).toBe(4);
    await expect(juntarArquivos([new Uint8Array([1, 2, 3, 4, 5])])).rejects.toThrow('não é PDF, PNG nem JPG');
  });
});

describe('numerar as páginas', () => {
  it('o texto do número', () => {
    expect(textoDoNumero('pagina-de', 3, 10)).toBe('Página 3 de 10');
    expect(textoDoNumero('de', 3, 10)).toBe('3 de 10');
    expect(textoDoNumero('numero', 3, 10)).toBe('3');
  });

  it('o rodapé da página como ela aparece, também na página girada', () => {
    const caixa = { x: 0, y: 0, width: 200, height: 300 };
    expect(posicaoNoRodape(caixa, 0, 20, 'direita', 10)).toEqual({ x: 170, y: 10, giro: 0 });
    expect(posicaoNoRodape(caixa, 0, 20, 'centro', 10)).toEqual({ x: 90, y: 10, giro: 0 });
    // girada 90: aparece deitada (300 × 200); o rodapé dela é a borda direita da página sem giro
    expect(posicaoNoRodape(caixa, 90, 20, 'esquerda', 10)).toEqual({ x: 190, y: 10, giro: 90 });
    expect(posicaoNoRodape(caixa, 180, 20, 'esquerda', 10)).toEqual({ x: 190, y: 290, giro: 180 });
    expect(posicaoNoRodape(caixa, 270, 20, 'esquerda', 10)).toEqual({ x: 10, y: 290, giro: 270 });
    // a caixa que não começa no 0 leva o deslocamento
    expect(posicaoNoRodape({ ...caixa, x: 5, y: 7 }, 0, 20, 'esquerda', 10)).toEqual({ x: 15, y: 17, giro: 0 });
  });

  it('escreve o número no rodapé de cada página', async () => {
    const numerado = await numerarPaginas(await pdfCom(3), { modelo: 'pagina-de', lugar: 'direita' });
    const paginas = await itensDoPdf(numerado);
    expect(paginas.map(p => p.map(i => i.texto).join(''))).toEqual(['Página 1 de 3', 'Página 2 de 3', 'Página 3 de 3']);
    expect(paginas[0][0].y).toBeLessThan(30);
    const doDois = await itensDoPdf(await numerarPaginas(await pdfCom(2), { modelo: 'numero', lugar: 'centro', primeiro: 2 }));
    expect(doDois.map(p => p.map(i => i.texto).join(''))).toEqual(['2', '3']);
  });
});

describe('os arquivos', () => {
  it('o zip leva todos, sem nome repetido', () => {
    const zip = zipDosArquivos([
      { nome: 'pág 1.png', bytes: new Uint8Array([1]) },
      { nome: 'pág 1.png', bytes: new Uint8Array([2]) },
      { nome: 'a/b.txt', bytes: new TextEncoder().encode('oi') },
    ]);
    const lido = XLSX.CFB.read(zip, { type: 'array' });
    // o leitor do SheetJS não olha o aviso de UTF-8 do zip (lê o nome byte a byte): volta para UTF-8 aqui
    const utf8 = (s: string) => new TextDecoder().decode(Uint8Array.from(s, ch => ch.charCodeAt(0)));
    const indice = lido.FileIndex as unknown as { name: string; type: number; content: Uint8Array }[];
    const arquivos = indice.filter(e => e.type === 2 && !e.name.startsWith('\u0001')).map(e => ({ ...e, name: utf8(e.name) }));
    expect(arquivos.map(e => e.name).sort()).toEqual(['a-b.txt', 'pág 1 (2).png', 'pág 1.png']);
    expect([...(arquivos.find(e => e.name === 'pág 1 (2).png')!.content as Uint8Array)]).toEqual([2]);
    expect(new TextDecoder().decode(arquivos.find(e => e.name === 'a-b.txt')!.content as Uint8Array)).toBe('oi');
  });

  it('o CRC do zip é o de sempre', () => {
    const bytes = new TextEncoder().encode('Nilma Contabilidade');
    expect(crcDoZip(bytes)).toBe(crc32(bytes) >>> 0);
  });

  it('move o item da lista', () => {
    expect(moverItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moverItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moverItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });

  it('o tamanho e a economia', () => {
    expect(tamanhoLegivel(2.5 * 1024 * 1024)).toBe('2,5 MB');
    expect(tamanhoLegivel(300)).toBe('1 KB');
    expect(economia(1000, 370)).toBe(63);
    expect(economia(1000, 1200)).toBe(0);
  });

  it('o texto do OCR em linhas, de cima para baixo e da esquerda para a direita', () => {
    expect(textoDosPedacos([
      { texto: 'mundo', x: 60, y: 700, largura: 30 },
      { texto: 'Linha 2', x: 10, y: 680, largura: 40 },
      { texto: 'Olá', x: 10, y: 702, largura: 20 },
      { texto: '  ', x: 0, y: 500, largura: 1 },
    ])).toBe('Olá mundo\nLinha 2');
  });
});
