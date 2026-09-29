import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { Lancamento } from '../tipos';
import { LINHAS_EM_BRANCO, NOME_ABA_LANCAMENTOS, livroDeLancamentos, nomeArquivoLancamentos, planilhaDeLancamentos, tipoMimeLancamentos } from './gerar';
import { EXTENSOES_CHEQUE, extensaoValida, lerPlanilhaCheque } from './ler';

const texto = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe('extensões', () => {
  it('aceita csv, xls, xlsx, xlsm sem ligar para maiúsculas', () => {
    expect([...EXTENSOES_CHEQUE]).toEqual(['.csv', '.xls', '.xlsx', '.xlsm']);
    for (const n of ['a.csv', 'B.XLS', 'c.xlsx', 'd.XlSm']) expect(extensaoValida(n)).toBe(true);
    for (const n of ['a.pdf', 'b.ods', 'csv', 'x.xlsx.txt']) expect(extensaoValida(n)).toBe(false);
  });
});

describe('lerPlanilhaCheque', () => {
  it('csv: células ficam como texto', () => {
    const linhas = lerPlanilhaCheque(texto('Data;Saldo\n05/01/2026;1.234,56 D\n'));
    expect(linhas).toEqual([['Data', 'Saldo'], ['05/01/2026', '1.234,56 D']]);
  });

  it('xlsx: datas viram Date, números ficam number e vazio vira null', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Data', 'H', 'Saldo'], [new Date(2026, 0, 5), null, -10.5]], { cellDates: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'A');
    const linhas = lerPlanilhaCheque(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
    expect(linhas[1][0]).toBeInstanceOf(Date);
    expect(linhas[1][1]).toBeNull();
    expect(linhas[1][2]).toBe(-10.5);
  });

  it('mensagens de erro do original', () => {
    expect(() => lerPlanilhaCheque(new ArrayBuffer(0))).toThrow('A planilha está vazia.');
    const zipQuebrado = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]).buffer;
    expect(() => lerPlanilhaCheque(zipQuebrado)).toThrow('O arquivo parece estar corrompido ou em um formato não suportado.');
  });
});

describe('planilha de lançamentos', () => {
  const lanc: Lancamento[] = [
    { data: new Date(2026, 0, 5), debito: '10509', credito: '90503', valor: 1234.5, historico: '92029', tipo: 'Ajuste', obs: '', projetado: false },
    { data: new Date(2026, 0, 6), debito: '90503', credito: '10509', valor: 1234.5, historico: '92029', tipo: 'Estorno', obs: '', projetado: false },
  ];

  it('layout: 4 linhas vazias, (vazio) · Débito · Crédito · Data · Valor · Histórico', () => {
    const wb = livroDeLancamentos(lanc);
    expect(wb.SheetNames).toEqual([NOME_ABA_LANCAMENTOS]);
    const ws = wb.Sheets[NOME_ABA_LANCAMENTOS];
    expect(ws['!ref']).toBe('A1:J6');
    expect(ws.B5.v).toBe('10509');
    expect(ws.C5.v).toBe('90503');
    expect(ws.D5).toMatchObject({ t: 'n', v: 46027, z: 'dd/mm/yyyy' });
    expect(ws.E5).toMatchObject({ t: 'n', v: 1234.5, z: '#,##0.00' });
    expect(ws.F5.v).toBe('92029');
    expect(ws.D6.v).toBe(46028);
    expect(ws['!cols']?.map(c => c.wch)).toEqual([6, 14, 14, 12, 14, 10, 6, 6, 6, 6]);
    expect(LINHAS_EM_BRANCO).toBe(4);
  });

  for (const formato of ['xlsx', 'xls'] as const) {
    it('bytes ' + formato + ' leem de volta com os mesmos valores', () => {
      const bytes = planilhaDeLancamentos(lanc, formato);
      expect(bytes).toBeInstanceOf(Uint8Array);
      const wb = XLSX.read(bytes, { type: 'array' });
      expect(wb.SheetNames).toEqual([NOME_ABA_LANCAMENTOS]);
      const linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[NOME_ABA_LANCAMENTOS], { header: 1, raw: true, defval: null, blankrows: false });
      expect(linhas.slice(-2)).toEqual([
        ['', '10509', '90503', 46027, 1234.5, '92029', '', '', '', ''],
        ['', '90503', '10509', 46028, 1234.5, '92029', '', '', '', ''],
      ]);
    });
  }

  it('nome do arquivo e MIME', () => {
    expect(nomeArquivoLancamentos('xlsx')).toBe('lancamentos_ajuste_cheque_especial.xlsx');
    expect(nomeArquivoLancamentos('xls')).toBe('lancamentos_ajuste_cheque_especial.xls');
    expect(nomeArquivoLancamentos('xlsx', '292')).toBe('lancamentos_ajuste_cheque_especial_292.xlsx');
    expect(nomeArquivoLancamentos('xls', '  ')).toBe('lancamentos_ajuste_cheque_especial.xls');
    expect(tipoMimeLancamentos('xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(tipoMimeLancamentos('xls')).toBe('application/vnd.ms-excel');
  });
});
