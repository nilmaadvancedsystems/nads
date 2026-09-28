// Planilha de lançamentos para importar no sistema contábil.
// Origem: cheque_especial.html — BLANK_LEAD_ROWS/buildLancamentosSheet (~L760) e
// downloadLancamentos (~L781). O download (Blob, <a>) é da View; aqui só saem os bytes.
import * as XLSX from 'xlsx';
import { dataParaSerialExcel } from '../regras/datas';
import type { Lancamento } from '../tipos';

export type FormatoLancamentos = 'xlsx' | 'xls';

/** O layout do sistema do escritório espera as 4 primeiras linhas vazias. */
export const LINHAS_EM_BRANCO = 4;
export const NOME_ABA_LANCAMENTOS = 'Ajuste Cheque Especial';

/** Colunas: (vazio) · Débito · Crédito · Data · Valor · Histórico · 4 vazias. */
export function livroDeLancamentos(lanc: Lancamento[]): XLSX.WorkBook {
  const aoa: (string | number)[][] = [];
  for (let b = 0; b < LINHAS_EM_BRANCO; b++) aoa.push(['', '', '', '', '', '', '', '', '', '']);
  for (const l of lanc) aoa.push(['', l.debito, l.credito, dataParaSerialExcel(l.data), l.valor, l.historico, '', '', '', '']);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let i = LINHAS_EM_BRANCO; i < aoa.length; i++) {
    const refData = XLSX.utils.encode_cell({ r: i, c: 3 });
    const refValor = XLSX.utils.encode_cell({ r: i, c: 4 });
    if (ws[refData]) ws[refData].z = 'dd/mm/yyyy';
    if (ws[refValor]) ws[refValor].z = '#,##0.00';
  }
  ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, NOME_ABA_LANCAMENTOS);
  return wb;
}

/** Bytes do arquivo: 'xlsx' ou 'xls' (Excel 97-2003, bookType 'biff8'). */
export function planilhaDeLancamentos(lanc: Lancamento[], formato: FormatoLancamentos): Uint8Array {
  const bookType: XLSX.BookType = formato === 'xlsx' ? 'xlsx' : 'biff8';
  const bytes: ArrayBuffer = XLSX.write(livroDeLancamentos(lanc), { bookType, type: 'array' });
  return new Uint8Array(bytes);
}

/** Tipo MIME para o Blob do download (o mesmo do original). */
export function tipoMimeLancamentos(formato: FormatoLancamentos): string {
  return formato === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/vnd.ms-excel';
}

/**
 * Nome do arquivo baixado. Sem código é o nome do original; com o código da empresa ele
 * entra antes da extensão (novidade do nads).
 */
export function nomeArquivoLancamentos(formato: FormatoLancamentos, codigoEmpresa?: string): string {
  const codigo = (codigoEmpresa || '').trim();
  return 'lancamentos_ajuste_cheque_especial' + (codigo ? '_' + codigo : '') + '.' + formato;
}
