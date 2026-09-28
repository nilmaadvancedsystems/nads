// Leitura dos arquivos: extrato de cada bandeira e planilha de vendas (notas fiscais).
// Origem: conciliadorZINHO.html parseCardStatementFile (~L870), parseSalesFile (~L923),
// validExt (~L1159), BRAND_EXTS (~L1220) e as extensões do wireStep2 (~L1386).
import * as XLSX from 'xlsx';
import { chaveDaData, lerDataFlexivel, lerNumeroFlexivel, limparHistorico, notaDoHistorico } from '../regras/formatos';
import { contarMeses } from '../regras/meses';
import type { Mes, MesContagem, Transacao, Venda } from '../tipos';

export const EXTENSOES_EXTRATO: readonly string[] = ['.csv', '.xls', '.xlsx', '.xlsm'];
export const EXTENSOES_VENDAS: readonly string[] = ['.xls', '.xlsx'];

/** O nome termina com uma das extensões (sem diferenciar maiúsculas). */
export function extensaoValida(nome: string, exts: readonly string[]): boolean {
  const n = nome.toLowerCase();
  return exts.some(e => n.endsWith(e));
}

/** Primeira aba como linhas com os valores crus (Date, número, texto ou null). null = não deu para ler. */
function linhasCruas(buf: ArrayBuffer): unknown[][] | null {
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true, raw: true }); }
  catch { return null; }
  const aba = wb && wb.SheetNames && wb.SheetNames[0];
  if (!aba) return null;
  try { return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[aba], { header: 1, raw: true, defval: null, blankrows: false }); }
  catch { return null; }
}

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Extrato da bandeira: coluna A = Data, B = Valor Bruto, C = Valor da Taxa (sem cabeçalho fixo:
 * linha que não tem data e os dois números é ignorada). Devolve os lançamentos por data e o mês
 * com mais lançamentos (empate: o que aparece primeiro). null = arquivo ilegível ou sem lançamento.
 */
export function lerExtrato(buf: ArrayBuffer): { transacoes: Transacao[]; mes: Mes } | null {
  const rows = linhasCruas(buf);
  if (!rows) return null;
  const tx: Transacao[] = [];
  for (const r of rows) {
    const row = r || [];
    const d = lerDataFlexivel(row[0]);
    const bruto = lerNumeroFlexivel(row[1]);
    const taxa = lerNumeroFlexivel(row[2]);
    if (d && bruto != null && taxa != null) tx.push({ data: d, chaveData: chaveDaData(d), bruto: arred(bruto), taxa: arred(taxa) });
  }
  if (!tx.length) return null;
  tx.sort((a, b) => a.data.getTime() - b.data.getTime());
  const conta: Record<string, number> = {};
  for (const t of tx) {
    const k = (t.data.getMonth() + 1) + '/' + t.data.getFullYear();
    conta[k] = (conta[k] || 0) + 1;
  }
  let melhor = '', qtdMelhor = 0;
  for (const k of Object.keys(conta)) if (conta[k] > qtdMelhor) { qtdMelhor = conta[k]; melhor = k; }
  const p = melhor.split('/');
  return { transacoes: tx, mes: { mes: parseInt(p[0], 10), ano: parseInt(p[1], 10) } };
}

/**
 * Planilha de vendas: C = Data, E = Contrapartida, G = Valor Bruto, H = código do Histórico,
 * I = Histórico ('...NF-CPF/CNPJ-NOME'). Linha sem data ou sem valor é ignorada (o cabeçalho cai aí).
 * null = arquivo ilegível ou sem nenhuma venda.
 */
export function lerVendas(buf: ArrayBuffer): { vendas: Venda[]; meses: MesContagem[] } | null {
  const rows = linhasCruas(buf);
  if (!rows) return null;
  const vendas: Venda[] = [];
  for (const r of rows) {
    const row = r || [];
    const d = lerDataFlexivel(row[2]);
    const bruto = lerNumeroFlexivel(row[6]);
    if (d && bruto != null) {
      const historico = limparHistorico(row[8]);
      vendas.push({
        data: d, chaveData: chaveDaData(d), bruto: arred(bruto),
        historico, nf: notaDoHistorico(historico),
        contrapartida: String(row[4] == null ? '' : row[4]).trim(),
        codigoHistorico: String(row[7] == null ? '' : row[7]).trim(),
      });
    }
  }
  if (!vendas.length) return null;
  return { vendas, meses: contarMeses(vendas) };
}
