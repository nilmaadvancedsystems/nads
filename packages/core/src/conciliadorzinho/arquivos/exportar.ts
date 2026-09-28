// Arquivos para importar no Alterdata: Excel 97-2003 (.xls, biff8) e CSV com ';'.
// Layout: 4 linhas vazias e depois as linhas, 10 colunas:
// ['', devedora, credora, data, valor, histórico, complemento, '', '', nota].
// Origem: conciliadorZINHO.html BLANK_ROWS (~L1796), buildFinalOutputs (~L1842-1884) e
// buildSaidaOutputs (~L2098-2137). O fallback de download do visualizador do claude.ai é da tela
// antiga e não entra aqui.
import * as XLSX from 'xlsx';
import { campoCsv, valorBR } from '../regras/formatos';
import type { LinhaArquivo } from '../tipos';

/** Linhas vazias antes dos lançamentos (sem cabeçalho nenhum no arquivo). */
export const LINHAS_EM_BRANCO = 4;

const linhaVazia = (): string[] => ['', '', '', '', '', '', '', '', '', ''];

function comBrancos<T>(linhas: T[][]): (T | string)[][] {
  const brancos: (T | string)[][] = [];
  for (let i = 0; i < LINHAS_EM_BRANCO; i++) brancos.push(linhaVazia());
  return brancos.concat(linhas);
}

/** Formato da coluna do valor: taxa em vermelho no arquivo da bandeira, o resto normal. */
export function formatoDoValor(l: LinhaArquivo, aba: 'Conciliacao' | 'Saidas'): string {
  return aba === 'Conciliacao' && l.tipo === 'Taxa' ? '[Red]#,##0.00' : '#,##0.00';
}

/** .xls (biff8) com a aba 'Conciliacao' (bandeira) ou 'Saidas'; valor como número. */
export function planilhaXls(linhas: LinhaArquivo[], aba: 'Conciliacao' | 'Saidas'): Uint8Array {
  const aoa = comBrancos<string | number>(linhas.map(l => ['', l.devedora, l.credora, l.data, l.valor, l.historico, l.complemento, '', '', l.nota]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  linhas.forEach((l, i) => {
    const cel = ws[XLSX.utils.encode_cell({ r: LINHAS_EM_BRANCO + i, c: 4 })] as XLSX.CellObject | undefined;
    if (cel) cel.z = formatoDoValor(l, aba);
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, aba);
  const saida: ArrayBuffer = XLSX.write(wb, { bookType: 'biff8', type: 'array' });
  return new Uint8Array(saida);
}

/** CSV: BOM (Excel lê o acento), ';' e '\r\n'; valor em texto pt-BR ('1.234,56'). */
export function textoCsv(linhas: LinhaArquivo[]): string {
  const aoa = comBrancos<string>(linhas.map(l => ['', l.devedora, l.credora, l.data, valorBR(l.valor), l.historico, l.complemento, '', '', l.nota]));
  return '\uFEFF' + aoa.map(r => r.map(campoCsv).join(';')).join('\r\n');
}
