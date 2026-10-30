import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { contarPaginas, girarPaginas, juntarPdfs, paginasDoTexto, removerPaginas, separarPdf } from './pdf';
import { converterPlanilha, formatoDaPlanilha } from './planilha';

/** Um PDF com n páginas em branco (para testar a contagem e as páginas copiadas). */
async function pdfCom(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([200, 200]);
  return doc.save();
}

describe('as páginas digitadas', () => {
  it('lê intervalos e avulsas, sem repetir, em ordem (índices a partir de 0)', () => {
    expect(paginasDoTexto('1-3, 5', 6)).toEqual({ paginas: [0, 1, 2, 4] });
    expect(paginasDoTexto('5, 2-3, 3', 6)).toEqual({ paginas: [1, 2, 4] });
  });

  it('recusa o que está fora, invertido ou em branco', () => {
    expect(paginasDoTexto('7', 6).erro).toContain('fora de 1 a 6');
    expect(paginasDoTexto('5-3', 6).erro).toContain('invertido');
    expect(paginasDoTexto('abc', 6).erro).toContain('não é uma página');
    expect(paginasDoTexto('  ', 6).erro).toBeTruthy();
  });
});

describe('o PDF', () => {
  it('conta as páginas e separa em grupos', async () => {
    const origem = await pdfCom(4);
    expect(await contarPaginas(origem)).toBe(4);
    const partes = await separarPdf(origem, [[0, 1], [2, 3]]);
    expect(partes).toHaveLength(2);
    expect(await contarPaginas(partes[0])).toBe(2);
    expect(await contarPaginas(partes[1])).toBe(2);
  });

  it('junta vários na ordem dada', async () => {
    const junto = await juntarPdfs([await pdfCom(2), await pdfCom(3)]);
    expect(await contarPaginas(junto)).toBe(5);
  });

  it('gira só as páginas indicadas, somando ao giro que já têm', async () => {
    const girado = await girarPaginas(await pdfCom(3), [1], 90);
    const doc = await PDFDocument.load(girado);
    const paginas = doc.getPages();
    expect(paginas[0].getRotation().angle).toBe(0);
    expect(paginas[1].getRotation().angle).toBe(90);
    expect(paginas[2].getRotation().angle).toBe(0);
  });

  it('tira páginas, e recusa tirar todas', async () => {
    const origem = await pdfCom(3);
    expect(await contarPaginas(await removerPaginas(origem, [0, 2]))).toBe(1);
    await expect(removerPaginas(origem, [0, 1, 2])).rejects.toThrow('todas as páginas');
  });
});

describe('a planilha', () => {
  it('reconhece o formato pelo nome', () => {
    expect(formatoDaPlanilha('Relatorio.XLSX')).toBe('xlsx');
    expect(formatoDaPlanilha('dados.csv')).toBe('csv');
    expect(formatoDaPlanilha('nota.pdf')).toBeNull();
  });

  it('converte csv com ponto e vírgula para xlsx, e xlsx de volta para csv', () => {
    const csv = new TextEncoder().encode('nome;valor\nAna;10\nBeto;20');
    const xlsx = converterPlanilha(csv, 'tabela.csv', 'xlsx');
    expect(xlsx.nome).toBe('tabela.xlsx');
    const lida = XLSX.read(xlsx.bytes, { type: 'array' });
    expect(XLSX.utils.sheet_to_json<Record<string, unknown>>(lida.Sheets[lida.SheetNames[0]])).toEqual([{ nome: 'Ana', valor: 10 }, { nome: 'Beto', valor: 20 }]);

    const volta = converterPlanilha(xlsx.bytes, 'tabela.xlsx', 'csv');
    expect(volta.nome).toBe('tabela.csv');
    const texto = new TextDecoder().decode(volta.bytes).replace('\uFEFF', '');
    expect(texto.trim().split(/\r?\n/)).toEqual(['nome;valor', 'Ana;10', 'Beto;20']);
  });

  it('recusa o que não é planilha', () => {
    expect(() => converterPlanilha(new Uint8Array([1, 2]), 'nota.pdf', 'csv')).toThrow('Formato não aceito');
  });
});
