// A planilha que o Importador LCDPR entrega (a mesma do lcdpr.html): Lancamentos_LCDPR.xls (Excel 97, BIFF8), a aba
// "Lancamentos LCDPR", uma linha por lançamento em ordem de data, com as 13 colunas que o programa do LCDPR importa
// (a primeira, "Lancamento Automatico", vai vazia; a data em dd/mm/aaaa; o valor como número).
import * as XLSX from 'xlsx';
import { porData } from './classificar';
import { dataBr } from './relatorios';
import type { Lancamento } from './tipos';

export const NOME_DA_PLANILHA = 'Lancamentos_LCDPR.xls';
export const ABA_DA_PLANILHA = 'Lancamentos LCDPR';
export const COLUNAS_DA_PLANILHA = ['Lancamento Automatico', 'Data', 'Conta Devedora', 'Conta Credora', 'Codigo Historico', 'Historico', 'Valor', 'Documento', 'Imovel', 'Tipo de Documento', 'Tipo de Lancamento', 'CPF/CNPJ', 'Produto'] as const;

/** O cabeçalho e uma linha por lançamento, em ordem de data. */
export function linhasDaPlanilha(lancs: readonly Lancamento[]): (string | number)[][] {
  return [
    [...COLUNAS_DA_PLANILHA],
    ...porData(lancs).map(r => ['', dataBr(r.data), r.contaDeved, r.contaCred, r.codHist, r.historico, Number(r.valor) || 0, r.documento, r.imovel, r.tipoDoc, r.tipoLanc, r.cnpj, r.produto]),
  ];
}

/** O arquivo .xls (BIFF8). */
export function planilhaDoLcdpr(lancs: readonly Lancamento[]): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhasDaPlanilha(lancs)), ABA_DA_PLANILHA);
  return new Uint8Array(XLSX.write(wb, { bookType: 'biff8', type: 'array' }) as ArrayBuffer);
}
