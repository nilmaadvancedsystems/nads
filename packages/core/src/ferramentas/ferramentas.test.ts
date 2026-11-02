import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { contarPaginas, girarPaginas, juntarPdfs, paginasDoTexto, removerPaginas, separarPdf } from './pdf';
import { converterPlanilha, formatoDaPlanilha, numeroDoCsv } from './planilha';

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

  it('lê o csv do Excel em português sem trocar valores, datas nem os zeros da frente', () => {
    const csv = new TextEncoder().encode('Data;CNPJ;Valor\n10/05/2026;01234567000189;1.234,56\n13/05/2026;00012345678;1234,5\n');
    const xlsx = converterPlanilha(csv, 'extrato.csv', 'xlsx');
    const aba = XLSX.read(xlsx.bytes, { type: 'array' }).Sheets.Sheet1;
    expect(aba.C2.v).toBe(1234.56);
    expect(aba.C3.v).toBe(1234.5);
    expect(aba.B2.v).toBe('01234567000189');
    expect(aba.B3.v).toBe('00012345678');
    expect(aba.A2.v).toBe(46152); // 10/05/2026 no Excel
    expect(aba.A3.v).toBe(46155);
    // e de volta para o csv: como estava, com a vírgula no decimal
    const texto = new TextDecoder().decode(converterPlanilha(xlsx.bytes, 'extrato.xlsx', 'csv').bytes).replace('﻿', '');
    expect(texto.trim().split(/\r?\n/)).toEqual(['Data;CNPJ;Valor', '10/05/2026;01234567000189;1234,56', '13/05/2026;00012345678;1234,5']);
  });

  it('o csv de saída tem a data em dd/mm/aaaa e o número com vírgula (o Excel em português lê como número)', () => {
    const aba = XLSX.utils.aoa_to_sheet([['Data', 'Valor', 'Fração'], [46300, 1234.56, 0.5]]);
    aba.A2.z = XLSX.SSF.get_table()[14];
    aba.B2.z = '#,##0.00';
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, aba, 'A');
    const bytes = new Uint8Array(XLSX.write(livro, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
    const texto = new TextDecoder().decode(converterPlanilha(bytes, 'b.xlsx', 'csv').bytes).replace('﻿', '');
    expect(texto.trim().split(/\r?\n/)).toEqual(['Data;Valor;Fração', '05/10/2026;1.234,56;0,5']);
  });

  it('o csv com vírgula de separador tem o ponto no decimal', () => {
    expect(numeroDoCsv('1234.56', ',')).toBe(1234.56);
    expect(numeroDoCsv('1.234,56', ';')).toBe(1234.56);
    expect(numeroDoCsv('-0,5', ';')).toBe(-0.5);
    expect(numeroDoCsv('0123', ';')).toBeNull();
    expect(numeroDoCsv('1.5', ';')).toBeNull();
  });

  it('recusa o que não é planilha', () => {
    expect(() => converterPlanilha(new Uint8Array([1, 2]), 'nota.pdf', 'csv')).toThrow('Formato não aceito');
  });
});
