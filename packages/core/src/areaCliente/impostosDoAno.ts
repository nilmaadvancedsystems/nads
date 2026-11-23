// Os impostos do ano na Área do Cliente (plano do Acessórias, ficha 2A.15 relatorio-de-impostos; o dono, 23/11/2026: "Faz
// agora"; e depois: "porque nao coloca essa de imprimir planilha numa aba de impostos? onde compara valor de folha, das, dae e
// outras coisas, no caso a planilha da defis so que em dados para o cliente"). A aba Impostos mostra, mês a mês do ano, o
// faturamento (as notas), a folha (a base do FGTS, do DP) e as guias que o escritório emitiu por imposto, com o total e
// quanto os impostos são do faturamento; e baixa a mesma conta em planilha. Sem robô novo: tudo vem do espelho que a Área
// já tem (resumo/faturamento, resumo/pessoal e as guias). É o valor das guias EMITIDAS, nunca "quanto paguei". Só a lógica.
import * as XLSX from 'xlsx';
import type { GuiaDoCliente } from './guias';

export const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const FORMATO_REAIS = '"R$" #,##0.00';
const FORMATO_PORCENTO = '0.0%';
/** quantos impostos têm coluna própria (o resto soma em "Outras guias") */
const COLUNAS_DE_IMPOSTO = 6;

type GuiaDoQuadro = Pick<GuiaDoCliente, 'tipo' | 'tributo' | 'competencia' | 'valor'>;

/** O nome do imposto da guia ("DAS", "DARF IRRF", "FGTS"). */
export function impostoDaGuia(g: Pick<GuiaDoCliente, 'tipo' | 'tributo'>): string {
  if (g.tipo === 'DARF' && g.tributo) return 'DARF ' + g.tributo;
  return g.tipo === 'outra' ? 'Outra guia' : g.tipo;
}

const redondo = (n: number) => Math.round(n * 100) / 100;
const doAno = (competencia: string, ano: number) => /^\d{4}-\d{2}$/.test(competencia) && Number(competencia.slice(0, 4)) === ano;

/** As linhas do ano por imposto: { imposto, meses[12], total }, o maior total primeiro. */
export function impostosDoAno(guias: readonly GuiaDoQuadro[], ano: number): { imposto: string; meses: number[]; total: number }[] {
  const porImposto = new Map<string, number[]>();
  for (const g of guias) {
    if (!doAno(g.competencia, ano) || !Number.isFinite(g.valor)) continue;
    const nome = impostoDaGuia(g);
    const meses = porImposto.get(nome) ?? Array(12).fill(0);
    meses[Number(g.competencia.slice(5, 7)) - 1] += g.valor;
    porImposto.set(nome, meses);
  }
  return [...porImposto.entries()].map(([imposto, meses]) => ({ imposto, meses: meses.map(redondo), total: redondo(meses.reduce((s, v) => s + v, 0)) }))
    .sort((a, b) => b.total - a.total || a.imposto.localeCompare(b.imposto, 'pt-BR'));
}

/** Um mês do quadro: null = sem dado (o mês não chegou). */
export interface MesDoQuadro { competencia: string; rotulo: string; faturamento: number | null; folha: number | null; impostos: number[]; total: number; porcento: number | null }

export interface QuadroDosImpostos {
  ano: number;
  /** os impostos com coluna (e "Outras guias" no fim, se houver) */
  colunas: string[];
  meses: MesDoQuadro[];
  totais: { faturamento: number; folha: number; impostos: number[]; total: number; porcento: number | null };
  /** algum dado no ano */
  temDado: boolean;
}

/**
 * O quadro do ano, mês a mês: o faturamento (a soma das empresas do link), a folha (a base do FGTS) e as guias por imposto.
 * No ano corrente, os meses vão até o mês de hoje.
 */
export function quadroDosImpostos(o: {
  ano: number;
  hoje: Date;
  faturamento: readonly { meses: readonly { competencia: string; total: number | null }[] }[];
  folha: readonly { competencia: string; base: number }[];
  guias: readonly GuiaDoQuadro[];
}): QuadroDosImpostos {
  const porImposto = impostosDoAno(o.guias, o.ano);
  const proprias = porImposto.slice(0, COLUNAS_DE_IMPOSTO);
  const outras = porImposto.slice(COLUNAS_DE_IMPOSTO);
  const colunas = [...proprias.map(x => x.imposto), ...(outras.length ? ['Outras guias'] : [])];
  const ultimo = o.ano === o.hoje.getFullYear() ? o.hoje.getMonth() : 11;
  const meses: MesDoQuadro[] = [];
  for (let i = 0; i <= ultimo; i++) {
    const comp = o.ano + '-' + String(i + 1).padStart(2, '0');
    const fats = o.faturamento.flatMap(e => e.meses.filter(m => m.competencia === comp && m.total != null).map(m => m.total as number));
    const faturamento = fats.length ? redondo(fats.reduce((s, v) => s + v, 0)) : null;
    const folhas = o.folha.filter(f => f.competencia === comp && Number.isFinite(f.base));
    const folha = folhas.length ? redondo(folhas.reduce((s, f) => s + f.base, 0)) : null;
    const impostos = [...proprias.map(x => x.meses[i]), ...(outras.length ? [redondo(outras.reduce((s, x) => s + x.meses[i], 0))] : [])];
    const total = redondo(impostos.reduce((s, v) => s + v, 0));
    meses.push({ competencia: comp, rotulo: MESES_CURTOS[i], faturamento, folha, impostos, total, porcento: faturamento && total ? total / faturamento : null });
  }
  const soma = (f: (m: MesDoQuadro) => number | null) => redondo(meses.reduce((s, m) => s + (f(m) ?? 0), 0));
  const fat = soma(m => m.faturamento);
  const total = soma(m => m.total);
  return {
    ano: o.ano, colunas, meses,
    totais: { faturamento: fat, folha: soma(m => m.folha), impostos: colunas.map((_, k) => soma(m => m.impostos[k])), total, porcento: fat ? total / fat : null },
    temDado: meses.some(m => m.faturamento != null || m.folha != null || m.total > 0),
  };
}

/** A planilha (xlsx) do quadro, no jeito da DEFIS: um mês por linha, o faturamento, a folha, cada imposto, o total e o %. */
export function planilhaDosImpostos(empresa: string, q: QuadroDosImpostos): Uint8Array<ArrayBuffer> {
  const cab = ['Mês', 'Faturamento (notas)', 'Folha (base do FGTS)', ...q.colunas, 'Total das guias', '% do faturamento'];
  const aoa: (string | number | null)[][] = [
    [empresa], ['Impostos de ' + q.ano + ': o valor das guias que o escritório emitiu (pela competência), não o que foi pago'], [],
    cab,
    ...q.meses.map(m => [m.rotulo + '/' + q.ano, m.faturamento, m.folha, ...m.impostos.map(v => v || null), m.total || null, m.porcento]),
    ['Total', q.totais.faturamento || null, q.totais.folha || null, ...q.totais.impostos.map(v => v || null), q.totais.total || null, q.totais.porcento],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const ultimaColuna = cab.length - 1;
  for (let r = 4; r < aoa.length; r++) for (let c = 1; c <= ultimaColuna; c++) {
    const cel = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
    if (cel) cel.z = c === ultimaColuna ? FORMATO_PORCENTO : FORMATO_REAIS;
  }
  ws['!cols'] = cab.map((_, i) => ({ wch: i === 0 ? 10 : 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Impostos ' + q.ano);
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}
