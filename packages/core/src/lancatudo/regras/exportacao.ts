// A saída do Lançatudo: o arquivo de importação do Alterdata no padrão do escritório (o mesmo do Creditor e dos Cartões:
// creditor/arquivos/gerar.ts) e a Simples Conferência, uma planilha para conferir antes de importar.
// Entrou no banco: D banco / C contrapartida. Saiu: D contrapartida / C banco.
import * as XLSX from 'xlsx';
import type { ContaDoPlano } from '../../empresas/cadastro/tipos';
import type { LinhaDeImportacao } from '../../extratudo/creditor/arquivos/gerar';
import type { LinhaDoRegistro } from '../tipos';

const dataBR = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

/** As linhas que vão para o Alterdata: as conciliadas e, se pedido, as sugeridas pelo razão. */
export function linhasParaExportar(linhas: readonly LinhaDoRegistro[], comSugeridas = false): LinhaDoRegistro[] {
  return linhas.filter(l => !!l.conta && !l.problema && (l.situacao === 'conciliada' || (comSugeridas && l.situacao === 'sugerida')));
}

/** O lançamento de uma linha no layout de importação. */
export function lancamentoDaLinha(l: LinhaDoRegistro): LinhaDeImportacao {
  const entrada = l.valor > 0;
  return {
    automatico: '', data: dataBR(l.data),
    debito: entrada ? l.contaDoBanco : (l.conta as string), credito: entrada ? (l.conta as string) : l.contaDoBanco,
    codHistorico: l.codHistorico || '', historico: l.historico, valor: Math.abs(l.valor) / 100, documento: l.documento || '',
  };
}

export function lancamentosParaImportar(linhas: readonly LinhaDoRegistro[], comSugeridas = false): LinhaDeImportacao[] {
  return linhasParaExportar(linhas, comSugeridas).map(lancamentoDaLinha);
}

/**
 * A Simples Conferência: uma planilha (.xlsx) com cada lançamento em duas linhas, a do débito e a do crédito — Data,
 * Histórico, Débito, Crédito, Conta, Classificação e Nome da conta —, para conferir antes de importar.
 */
export function planilhaDaConferencia(linhas: readonly LinhaDoRegistro[], plano: readonly ContaDoPlano[] | null, comSugeridas = false): Uint8Array {
  const porCodigo = new Map((plano || []).map(c => [c.codigo, c]));
  const aoa: (string | number)[][] = [['Data', 'Histórico', 'Débito', 'Crédito', 'Conta', 'Classificação', 'Nome da conta']];
  for (const l of linhasParaExportar(linhas, comSugeridas)) {
    const x = lancamentoDaLinha(l);
    for (const [conta, lado] of [[x.debito, 'D'], [x.credito, 'C']] as const) {
      const c = porCodigo.get(conta);
      aoa.push([x.data, x.historico, lado === 'D' ? x.valor : '', lado === 'C' ? x.valor : '', /^\d+$/.test(conta) ? Number(conta) : conta, c?.classificacao || '', c?.nome || (conta === l.contaDoBanco ? '' : l.nomeDaConta)]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 1; r < aoa.length; r++) for (const col of [2, 3]) {
    const cel = ws[XLSX.utils.encode_cell({ r, c: col })];
    if (cel && typeof cel.v === 'number') cel.z = '#,##0.00';
  }
  ws['!cols'] = [{ wch: 11 }, { wch: 60 }, { wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 16 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conferencia');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

export const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** O nome do arquivo: lancatudo_<código>_<banco>_<aaaa-mm>.xls (ou _conferencia.xlsx). */
export function nomeDoArquivoDoLancatudo(codigo: number | null, banco: string, competencia: string, conferencia = false): string {
  const b = banco.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '');
  return 'lancatudo_' + (codigo ?? 'empresa') + '_' + (b || 'banco') + '_' + competencia + (conferencia ? '_conferencia.xlsx' : '.xls');
}
