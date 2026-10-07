// Arquivo de importação contábil (seção 4 do fluxo): .xls antigo (BIFF8), layout de 8 colunas,
// VALOR e DOCUMENTO numéricos, VALOR com 2 casas. A data vai como data de verdade, mostrada DD/MM/AAAA
// (igual ao arquivo do Cheque especial).
import * as XLSX from 'xlsx';
import type { Lancamento } from '../tipos';

/** O que o arquivo precisa de cada lançamento (o Creditor e o Cartões usam o mesmo layout). */
export type LinhaDeImportacao = Pick<Lancamento, 'automatico' | 'data' | 'debito' | 'credito' | 'codHistorico' | 'historico' | 'valor' | 'documento'>;

export const CABECALHO_8_COLUNAS = ['LANC AUTOMÁTICO', 'DATA', 'DÉBITO', 'CRÉDITO', 'COD HISTÓRICO', 'HISTÓRICO', 'VALOR', 'DOCUMENTO'] as const;

function serialExcel(dataBr: string): number | string {
  const m = dataBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return dataBr;
  return Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86400000 + 25569;
}

const numeroOuTexto = (s: string): number | string => (/^\d+$/.test(s) ? Number(s) : s);

export function livroDeImportacao(lancamentos: readonly LinhaDeImportacao[]): XLSX.WorkBook {
  const aoa: (string | number)[][] = [[...CABECALHO_8_COLUNAS]];
  for (const l of lancamentos) {
    aoa.push([l.automatico, serialExcel(l.data), numeroOuTexto(l.debito), numeroOuTexto(l.credito), numeroOuTexto(l.codHistorico), l.historico, l.valor, numeroOuTexto(l.documento)]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 1; r < aoa.length; r++) {
    const d = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    if (d && typeof d.v === 'number') d.z = 'dd/mm/yyyy';
    const v = ws[XLSX.utils.encode_cell({ r, c: 6 })];
    if (v) v.z = '0.00';
  }
  ws['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 48 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Importacao');
  return wb;
}

/** Bytes do .xls (Excel 97-2003). */
export function planilhaDeImportacao(lancamentos: readonly LinhaDeImportacao[]): Uint8Array {
  return new Uint8Array(XLSX.write(livroDeImportacao(lancamentos), { bookType: 'biff8', type: 'array' }) as ArrayBuffer);
}

export const TIPO_XLS = 'application/vnd.ms-excel';

export function nomeDoArquivo(codigoEmpresa: string | null): string {
  return 'creditor_importacao' + (codigoEmpresa ? '_' + codigoEmpresa : '') + '.xls';
}
