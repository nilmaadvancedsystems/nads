// Leitura do relatório de saldo (csv, xls, xlsx, xlsm) — tudo em memória.
// Origem: cheque_especial.html — VALID_EXTS/validExt (~L412) e readSheet (~L494).
import * as XLSX from 'xlsx';

export const EXTENSOES_CHEQUE: readonly string[] = ['.csv', '.xls', '.xlsx', '.xlsm'];

export function extensaoValida(nome: string): boolean {
  const minusculo = nome.toLowerCase();
  return EXTENSOES_CHEQUE.some(ext => minusculo.endsWith(ext));
}

/**
 * Primeira aba como linhas de valores brutos (Date nas datas, number nos números, null no
 * vazio). Lança Error com a mesma mensagem que o original mostrava.
 */
export function lerPlanilhaCheque(buf: ArrayBuffer): unknown[][] {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true, raw: true });
  } catch {
    throw new Error('O arquivo parece estar corrompido ou em um formato não suportado.');
  }
  const aba = wb.SheetNames[0];
  if (!aba) throw new Error('A planilha não contém nenhuma aba.');
  let linhas: unknown[][];
  try {
    linhas = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, raw: true, defval: null, blankrows: false });
  } catch {
    throw new Error('Não foi possível interpretar as linhas da planilha.');
  }
  if (!linhas || !linhas.length) throw new Error('A planilha está vazia.');
  return linhas;
}
