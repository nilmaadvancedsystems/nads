// A leitura do arquivo da planilha de recebimentos (xlsx, xls, csv, ods), no navegador: a primeira aba como linhas cruas
// (a data como número de série, o valor como número) para o lerPlanilhaDeRecebimentos. Nada sai da máquina.
import * as XLSX from 'xlsx';
import { lerPlanilhaDeRecebimentos, type Recebimento } from './recebimentos';

export function lerArquivoDeRecebimentos(buf: ArrayBuffer): { recebimentos: Recebimento[]; avisos: string[] } {
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba) return { recebimentos: [], avisos: ['O arquivo não tem nenhuma aba.'] };
  return lerPlanilhaDeRecebimentos(XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, defval: '', raw: true, blankrows: false }));
}
