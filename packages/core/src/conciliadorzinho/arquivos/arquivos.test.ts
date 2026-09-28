import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { LinhaArquivo } from '../tipos';
import { planilhaXls, textoCsv } from './exportar';
import { extensaoValida, EXTENSOES_EXTRATO, EXTENSOES_VENDAS, lerExtrato, lerVendas } from './leitura';

function xlsx(aoa: unknown[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Plan1');
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
}
const texto = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('leitura', () => {
  it('extensões', () => {
    expect(extensaoValida('EXTRATO.CSV', EXTENSOES_EXTRATO)).toBe(true);
    expect(extensaoValida('a.xlsm', EXTENSOES_EXTRATO)).toBe(true);
    expect(extensaoValida('a.csv', EXTENSOES_VENDAS)).toBe(false);
    expect(extensaoValida('a.pdf', EXTENSOES_EXTRATO)).toBe(false);
  });

  it('extrato: A data, B bruto, C taxa; ignora cabeçalho; mês com mais lançamentos', () => {
    const r = lerExtrato(xlsx([
      ['Data', 'Bruto', 'Taxa'],
      [new Date(2026, 7, 1), 80, 2],
      ['05/07/2026', 'R$ 1.234,56', '(3,21)'],
      ['07/07/2026', '1.234,567', 0], // 3 casas depois da vírgula: vira 1,234567 (como o original)
      [46209, '50,00', '1,10'],
      ['total', 1, 1],
    ]));
    expect(r).not.toBeNull();
    expect(r!.transacoes.map(t => [t.chaveData, t.bruto, t.taxa])).toEqual([
      ['05/07/2026', 1234.56, -3.21], ['06/07/2026', 50, 1.1], ['07/07/2026', 1.23, 0], ['01/08/2026', 80, 2],
    ]);
    expect(r!.mes).toEqual({ mes: 7, ano: 2026 });
  });

  it('extrato: empate no mês fica com o primeiro em ordem de data', () => {
    const r = lerExtrato(xlsx([['01/08/2026', 1, 0], ['01/07/2026', 1, 0]]));
    expect(r!.mes).toEqual({ mes: 7, ano: 2026 });
  });

  it('extrato ilegível ou vazio = null', () => {
    expect(lerExtrato(xlsx([['Data', 'Bruto', 'Taxa']]))).toBeNull();
    expect(lerExtrato(texto(''))).toBeNull();
  });

  it('vendas: C data, E contrapartida, G bruto, H código, I histórico', () => {
    const r = lerVendas(xlsx([
      ['', '', 'Data', '', 'Contra', '', 'Valor', 'Hist', 'Histórico'],
      ['', '', '05/07/2026', '', ' 11201 ', '', 'R$ 100,00', 300, 'Pelas vendas conforme NF-e nº 200294 - 0 - CONSUMIDOR FINAL'],
      ['', '', '06/07/2026', '', null, '', 50, null, null],
      ['', '', 'x', '', '', '', 1, '', ''],
    ]));
    expect(r!.vendas).toEqual([
      { data: new Date(2026, 6, 5), chaveData: '05/07/2026', bruto: 100, historico: '200294-0-CONSUMIDOR FINAL', nf: '200294', contrapartida: '11201', codigoHistorico: '300' },
      { data: new Date(2026, 6, 6), chaveData: '06/07/2026', bruto: 50, historico: '', nf: '', contrapartida: '', codigoHistorico: '' },
    ]);
    expect(r!.meses).toEqual([{ mes: 7, ano: 2026, qtd: 2 }]);
    expect(lerVendas(xlsx([['a']]))).toBeNull();
  });
});

describe('exportação', () => {
  const linhas: LinhaArquivo[] = [
    { devedora: '21105', credora: '30101', data: '05/07/2026', valor: 1234.5, historico: '15', complemento: '1-0-A;B "X"', nota: '1', tipo: 'Bruto', casou: true },
    { devedora: '40101', credora: '21105', data: '05/07/2026', valor: 2, historico: '92060', complemento: '', nota: '', tipo: 'Taxa', casou: true },
  ];

  it('csv com BOM, ; e 4 linhas vazias', () => {
    expect(textoCsv(linhas)).toBe('\uFEFF' + [
      ';;;;;;;;;', ';;;;;;;;;', ';;;;;;;;;', ';;;;;;;;;',
      ';21105;30101;05/07/2026;1.234,50;15;"1-0-A;B ""X""";;;1',
      ';40101;21105;05/07/2026;2,00;92060;;;;',
    ].join('\r\n'));
  });

  it('xls biff8: valor numérico e taxa em vermelho só na aba Conciliacao', () => {
    const ler = (b: Uint8Array) => XLSX.read(b, { type: 'array', cellNF: true });
    const wb = ler(planilhaXls(linhas, 'Conciliacao'));
    expect(wb.SheetNames).toEqual(['Conciliacao']);
    const ws = wb.Sheets.Conciliacao;
    expect(ws['!ref']).toBe('A1:J6');
    expect(ws.E5.v).toBe(1234.5);
    expect(ws.E5.z).toBe('#,##0.00');
    expect(ws.E6.z).toBe('[Red]#,##0.00');
    expect(ws.J5.v).toBe('1');
    const saidas = ler(planilhaXls(linhas, 'Saidas'));
    expect(saidas.SheetNames).toEqual(['Saidas']);
    expect(saidas.Sheets.Saidas.E6.z).toBe('#,##0.00');
  });
});
