import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { corDoExcel, ehPlanilha, LIMITE_DE_LINHAS, lerPlanilhaNoNavegador, textoEmPortugues } from './planilhaNoNavegador';

async function arquivo(montar: (ws: ExcelJS.Worksheet, livro: ExcelJS.Workbook) => void): Promise<Uint8Array> {
  const livro = new ExcelJS.Workbook();
  montar(livro.addWorksheet('Folha'), livro);
  return new Uint8Array(await livro.xlsx.writeBuffer());
}

describe('a planilha aberta no navegador', () => {
  it('reconhece os arquivos que abre', () => {
    expect(['a.xlsx', 'b.XLS', 'c.csv', 'd.ods'].every(ehPlanilha)).toBe(true);
    expect(ehPlanilha('extrato.pdf')).toBe(false);
  });
  it('mostra número e data como no Excel em português', () => {
    expect(textoEmPortugues({ t: 'n', v: 1234.5, w: '1,234.50', z: '#,##0.00' })).toBe('1.234,50');
    expect(textoEmPortugues({ t: 'n', v: 0.5, w: '0.5' })).toBe('0,5');
    expect(textoEmPortugues({ t: 'n', v: 1234.5, w: 'R$ 1,234.50', z: '"R$"\\ #,##0.00;"-R$"\\ #,##0.00' })).toBe('R$ 1.234,50');
    expect(textoEmPortugues({ t: 'n', v: 46037, w: '1/15/26', z: 'm/d/yy' })).toBe('15/01/2026');
    expect(textoEmPortugues({ t: 'n', v: 46037, w: '15/01/2026', z: 'dd/mm/yyyy' })).toBe('15/01/2026');
    expect(textoEmPortugues({ t: 'n', v: 12345678, w: '12.345.678', z: '00\\.000\\.000' })).toBe('12.345.678');
    expect(textoEmPortugues({ t: 's', v: 'a,b.c', w: 'a,b.c' })).toBe('a,b.c');
  });
  it('as cores: direta, do tema com tom e da paleta', () => {
    expect(corDoExcel({ argb: 'FF1F4E78' })).toBe('#1f4e78');
    expect(corDoExcel({ theme: 1 })).toBe('#000000');
    expect(corDoExcel({ theme: 0, tint: -0.5 })).toBe('#808080');
    expect(corDoExcel({ indexed: 2 })).toBe('#ff0000');
    expect(corDoExcel({ indexed: 64 })).toBeUndefined();
  });
  it('traz valores, mescla, largura e formatação do .xlsx', async () => {
    const p = await lerPlanilhaNoNavegador('a.xlsx', await arquivo(ws => {
      ws.getColumn(1).width = 20;
      ws.mergeCells('A1:C1');
      ws.getCell('A1').value = 'Título';
      ws.getCell('A1').font = { bold: true };
      ws.getCell('A2').value = 1234.5;
      ws.getCell('A2').numFmt = '#,##0.00';
      ws.getCell('B2').value = 'x';
      ws.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    }));
    expect(p.comFormatacao).toBe(true);
    const a = p.abas[0];
    expect(a.colunas.map(c => c.letra)).toEqual(['A', 'B', 'C']);
    expect(a.colunas[0].largura).toBeGreaterThan(100);
    expect(a.linhas[0].celulas).toHaveLength(1);
    expect(a.linhas[0].celulas[0]).toMatchObject({ texto: 'Título', colunas: 3 });
    expect(a.linhas[0].celulas[0].estilo?.negrito).toBe(true);
    expect(a.linhas[1].celulas[0]).toMatchObject({ texto: '1.234,50', numero: true });
    expect(a.linhas[1].celulas[1].estilo?.fundo).toBe('#ffff00');
  });
  it('o texto comprido ocupa as vazias à direita, e para na que tem valor', async () => {
    const texto = 'um texto bem comprido que não cabe numa coluna só de jeito nenhum';
    const p = await lerPlanilhaNoNavegador('a.xlsx', await arquivo(ws => {
      ws.getCell('A1').value = texto;
      ws.getCell('C1').value = 'b';
      ws.getCell('A2').value = texto;
      ws.getCell('H2').value = 'fim';
    }));
    expect(p.abas[0].linhas[0].celulas.map(c => c.colunas).slice(0, 2)).toEqual([2, 1]);
    expect(p.abas[0].linhas[1].celulas[0].colunas).toBeGreaterThan(2);
    expect(p.abas[0].linhas[0].celulas.map(c => c.coluna)).toEqual([0, 2, ...Array.from({ length: 5 }, (_, i) => i + 3)]);
  });
  it('lê o .xls antigo (sem formatação), deixa a aba oculta de fora e corta as linhas demais', async () => {
    const ws = XLSX.utils.aoa_to_sheet(Array.from({ length: LIMITE_DE_LINHAS + 5 }, (_, i) => [i]));
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, ws, 'Boa');
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['x']]), 'Oculta');
    livro.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 1 }] };
    const p = await lerPlanilhaNoNavegador('a.xls', new Uint8Array(XLSX.write(livro, { type: 'array', bookType: 'biff8' })));
    expect(p.comFormatacao).toBe(false);
    expect(p.abas.map(a => a.nome)).toEqual(['Boa']);
    expect(p.abas[0].linhas).toHaveLength(LIMITE_DE_LINHAS);
    expect(p.abas[0].totalDeLinhas).toBe(LIMITE_DE_LINHAS + 5);
  });
  it('o arquivo que o ExcelJS não entende abre sem formatação', async () => {
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, XLSX.utils.aoa_to_sheet([['a']]), 'A');
    const p = await lerPlanilhaNoNavegador('falso.xlsx', new Uint8Array(XLSX.write(livro, { type: 'array', bookType: 'xls' })));
    expect(p.comFormatacao).toBe(false);
    expect(p.abas[0].linhas[0].celulas[0].texto).toBe('a');
  });
});
