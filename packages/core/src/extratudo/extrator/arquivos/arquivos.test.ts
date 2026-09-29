import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { criarRepoExtratorMemoria } from '../repo.memoria';
import { lerArquivo } from './leitura';

/** PDF de uma página com Helvetica: cada linha é [x, y, texto]. */
function pdfMinimo(linhas: [number, number, string][]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, m => '\\' + m);
  const conteudo = linhas.map(([x, y, t]) => 'BT /F1 9 Tf ' + x + ' ' + y + ' Td (' + esc(t) + ') Tj ET').join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + conteudo.length + ' >>\nstream\n' + conteudo + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let s = '%PDF-1.4\n';
  const pos: number[] = [];
  objs.forEach((o, i) => { pos.push(s.length); s += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = s.length;
  s += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  s += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return new TextEncoder().encode(s);
}

function xlsx(linhas: unknown[][]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), 'Razao');
  return new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}

describe('leitura dos arquivos', () => {
  it('PDF de extrato', async () => {
    const r = await lerArquivo('extrato.pdf', pdfMinimo([
      [40, 760, 'BANCO EXEMPLO - Extrato de 01/08/2026 a 31/08/2026'],
      [40, 740, 'Data'], [100, 740, 'Historico'], [400, 740, 'Valor'], [480, 740, 'Saldo'],
      [40, 720, '03/08/2026'], [100, 720, 'PIX RECEBIDO CLIENTE ALFA'], [400, 720, '4.500,00'], [480, 720, '14.500,00'],
      [40, 706, '04/08/2026'], [100, 706, 'TARIFA PACOTE'], [400, 706, '-45,90'], [480, 706, '14.454,10'],
    ]), 'banco');
    expect(r.erro).toBeNull();
    expect(r.lancamentos).toEqual([
      { data: '2026-08-03', valor: 450000, historico: 'PIX RECEBIDO CLIENTE ALFA' },
      { data: '2026-08-04', valor: -4590, historico: 'TARIFA PACOTE' },
    ]);
  });

  it('PDF sem texto', async () => {
    const r = await lerArquivo('foto.pdf', pdfMinimo([[40, 700, 'x']]), 'banco');
    expect(r.erro).toMatch(/digitalizado/);
  });

  it('Excel do razão', async () => {
    const r = await lerArquivo('razao.xlsx', xlsx([['Data', 'Histórico', 'Débito', 'Crédito'], ['03/08/2026', 'Recebimento', '4.500,00', ''], [new Date(2026, 7, 4), 'Energia', '', 12.9]]), 'sistema');
    expect(r.lancamentos.map(x => [x.data, x.valor])).toEqual([['2026-08-03', 450000], ['2026-08-04', -1290]]);
  });

  it('CSV com ; e data dd/mm (não vira mm/dd)', async () => {
    const r = await lerArquivo('razao.csv', new TextEncoder().encode('Data;Histórico;Valor;D/C\n05/08/2026;Recebimento;1.000,00;D\n'), 'sistema');
    expect(r.lancamentos).toEqual([{ data: '2026-08-05', valor: 100000, historico: 'Recebimento' }]);
  });

  it('OFX pelo conteúdo', async () => {
    const r = await lerArquivo('extrato.txt', new TextEncoder().encode('OFXHEADER:100\n<OFX><STMTTRN><DTPOSTED>20260805<TRNAMT>-1.50<MEMO>TARIFA</STMTTRN></OFX>'), 'banco');
    expect(r.lancamentos).toEqual([{ data: '2026-08-05', valor: -150, historico: 'TARIFA' }]);
  });

  it('arquivo que não é planilha', async () => {
    const r = await lerArquivo('x.xlsx', new TextEncoder().encode('isso não é uma planilha'), 'banco');
    expect(r.lancamentos).toEqual([]);
    expect(r.erro).toBeTruthy();
  });
});

describe('repositório em memória', () => {
  it('exemplos: lista 901-903 e a 901 já tem extrato e razão', () => {
    const repo = criarRepoExtratorMemoria({ exemplos: true, guarda: null });
    expect(repo.listarEmpresas().map(e => e.codigo)).toEqual([901, 902, 903]);
    expect(repo.obter('EXEMPLO COMERCIO DE ALIMENTOS LTDA')?.arquivos.map(a => a.lado)).toEqual(['banco', 'sistema']);
    expect(repo.obter('EXEMPLO EMPRESA NOVA LTDA')).toBeNull();
  });

  it('salvar avisa, guarda e restaurar volta ao início', () => {
    let guardado: string | null = null;
    const guarda = { ler: () => guardado, gravar: (v: string) => { guardado = v; }, apagar: () => { guardado = null; } };
    const repo = criarRepoExtratorMemoria({ exemplos: true, guarda });
    let avisos = 0;
    const parar = repo.assinar(() => avisos++);
    repo.salvar({ nome: 'EXEMPLO EMPRESA NOVA LTDA', arquivos: [], auditoria: [] });
    expect([avisos, repo.versao()]).toEqual([1, 1]);
    expect(criarRepoExtratorMemoria({ exemplos: true, guarda }).obter('EXEMPLO EMPRESA NOVA LTDA')).not.toBeNull();
    repo.restaurarExemplos();
    expect(repo.obter('EXEMPLO EMPRESA NOVA LTDA')).toBeNull();
    parar();
  });

  it('escritório: começa vazio com a lista que receber', () => {
    const repo = criarRepoExtratorMemoria({ exemplos: false, guarda: null, lista: [{ codigo: 1, nome: 'A', regime: '' }] });
    expect(repo.listarEmpresas()).toHaveLength(1);
    expect(repo.obter('EXEMPLO COMERCIO DE ALIMENTOS LTDA')).toBeNull();
  });
});
