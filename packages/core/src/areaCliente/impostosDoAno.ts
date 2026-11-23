// Os impostos das guias do ano na Área do Cliente (plano do Acessórias, ficha 2A.15 relatorio-de-impostos; o dono,
// 23/11/2026: "Faz agora"). O caminho barato do plano: sem robô novo, a planilha sai das guias que o escritório mandou e
// estão na Área (o espelho): uma linha por imposto, uma coluna por mês da competência, e o total. É o valor das guias
// EMITIDAS, nunca "quanto paguei" (o rótulo diz isso). Só a lógica (a planilha em bytes).
import * as XLSX from 'xlsx';
import type { GuiaDoCliente } from './guias';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const FORMATO_REAIS = '"R$" #,##0.00';

/** O nome do imposto da guia ("DAS", "DARF IRRF", "FGTS"). */
export function impostoDaGuia(g: Pick<GuiaDoCliente, 'tipo' | 'tributo'>): string {
  if (g.tipo === 'DARF' && g.tributo) return 'DARF ' + g.tributo;
  return g.tipo === 'outra' ? 'Outra guia' : g.tipo;
}

/** As linhas do ano: { imposto, meses[12], total }, o maior total primeiro (só as guias da competência do ano). */
export function impostosDoAno(guias: readonly Pick<GuiaDoCliente, 'tipo' | 'tributo' | 'competencia' | 'valor'>[], ano: number): { imposto: string; meses: number[]; total: number }[] {
  const porImposto = new Map<string, number[]>();
  for (const g of guias) {
    if (!/^\d{4}-\d{2}$/.test(g.competencia) || Number(g.competencia.slice(0, 4)) !== ano || !Number.isFinite(g.valor)) continue;
    const nome = impostoDaGuia(g);
    const meses = porImposto.get(nome) ?? Array(12).fill(0);
    meses[Number(g.competencia.slice(5, 7)) - 1] += g.valor;
    porImposto.set(nome, meses);
  }
  const redondo = (n: number) => Math.round(n * 100) / 100;
  return [...porImposto.entries()].map(([imposto, meses]) => ({ imposto, meses: meses.map(redondo), total: redondo(meses.reduce((s, v) => s + v, 0)) }))
    .sort((a, b) => b.total - a.total || a.imposto.localeCompare(b.imposto, 'pt-BR'));
}

/** A planilha (xlsx) dos impostos das guias emitidas no ano. */
export function planilhaDosImpostos(empresa: string, guias: readonly Pick<GuiaDoCliente, 'tipo' | 'tributo' | 'competencia' | 'valor'>[], ano: number): Uint8Array<ArrayBuffer> {
  const linhas = impostosDoAno(guias, ano);
  const totalDoMes = MESES.map((_, i) => linhas.reduce((s, l) => s + l.meses[i], 0));
  const aoa: (string | number | null)[][] = [
    [empresa], ['Impostos das guias emitidas pelo escritório em ' + ano + ' (pela competência; o valor da guia, não o pago)'], [],
    ['Imposto', ...MESES, 'Total'],
    ...linhas.map(l => [l.imposto, ...l.meses.map(v => (v ? v : null)), l.total]),
    ['Total', ...totalDoMes.map(v => (v ? Math.round(v * 100) / 100 : null)), Math.round(linhas.reduce((s, l) => s + l.total, 0) * 100) / 100],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 4; r < aoa.length; r++) for (let c = 1; c <= 13; c++) {
    const cel = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
    if (cel) cel.z = FORMATO_REAIS;
  }
  ws['!cols'] = [{ wch: 16 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Impostos ' + ano);
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}
