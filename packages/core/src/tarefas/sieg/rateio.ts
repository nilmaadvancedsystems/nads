// O Rateio de frete (Heverton, 22/10/2026: a planilha "RATEIO - FRETE" do Fiscal). Puro: a tela só desenha.
//   A planilha recebe o total dos produtos, o frete e o desconto e reparte o frete entre as tributações da nota pela parte
//   de cada uma no total (VALOR × 100 / TOTAL = PORCENTAGEM; FRETE × PORCENTAGEM %); depois, dentro de uma tributação,
//   reparte o frete dela entre os NCMs do mesmo jeito, com a base = VALOR + IPI + FRETE.
//   Aqui: o desconto se reparte igual ao frete e a base de cada linha é VALOR + IPI + FRETE − DESCONTO. A conta é feita em
//   centavos (o maior resto): a soma das linhas bate com o frete e o desconto da nota, sem diferença de centavo.
//   Quando as linhas não somam o total (na planilha, os NCMs de uma parte só), a porcentagem é sobre o total e o que sobra
//   do frete fica para os produtos que não estão na lista (foraDaLista).
//   Pela nota do SIEG: os itens agrupados pela tributação (as mesmas classificações do Simples: ST pelo CST/CSOSN ou pelo
//   CFOP, monofásico pelo NCM; isento pelo CST 40/41/50 ou CSOSN 103/300/400) ou pelo CFOP, como na planilha.
import type { ItemDoXml, NotaDoSieg } from './index';
import { grupoMonofasico, temIcmsSt } from './simples';

const so = (v: unknown) => String(v || '').replace(/\D/g, '');
const emCentavos = (v: number) => Math.round((Number(v) || 0) * 100);

/**
 * Reparte `total` (em reais) pelos `pesos`, em centavos: cada um fica com a parte inteira e os centavos que sobram vão para
 * os maiores restos (o primeiro, no empate). A soma dá exatamente o total. Pesos zerados ficam com zero.
 */
export function repartir(total: number, pesos: readonly number[]): number[] {
  const c = emCentavos(total);
  const soma = pesos.reduce((t, p) => t + Math.max(0, p), 0);
  if (!c || soma <= 0) return pesos.map(() => 0);
  const exatos = pesos.map(p => (c * Math.max(0, p)) / soma);
  const partes = exatos.map(Math.floor);
  let falta = c - partes.reduce((t, p) => t + p, 0);
  const ordem = exatos.map((e, i) => ({ i, resto: e - partes[i] })).sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (let k = 0; falta > 0 && k < ordem.length; k++, falta--) partes[ordem[k].i]++;
  return partes.map(p => p / 100);
}

/** Uma linha a ratear: a tributação (ou o NCM), o valor dos produtos e o IPI. */
export interface LinhaParaRatear { rotulo: string; valor: number; ipi?: number }

export interface LinhaRateada {
  rotulo: string; valor: number; ipi: number;
  /** a parte no total, em % (VALOR × 100 / TOTAL) */
  pct: number;
  frete: number; desconto: number;
  /** VALOR + IPI + FRETE − DESCONTO */
  base: number;
}

export interface Rateio {
  linhas: LinhaRateada[];
  /** o total dos produtos (o informado; sem ele, a soma das linhas) */
  total: number;
  frete: number; desconto: number;
  /** as somas das linhas */
  soma: { valor: number; ipi: number; pct: number; frete: number; desconto: number; base: number };
  /** a parte do total que não está nas linhas (o total maior que a soma), com o frete e o desconto dela; null = bate */
  foraDaLista: { valor: number; frete: number; desconto: number } | null;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/**
 * O rateio da planilha: o frete e o desconto repartidos pelas linhas, na proporção do valor de cada uma no total.
 * `total` vazio (ou menor que as linhas) = a soma das linhas.
 */
export function ratear(e: { total?: number | null; frete: number; desconto?: number; linhas: readonly LinhaParaRatear[] }): Rateio {
  const linhas = e.linhas.map(l => ({ rotulo: l.rotulo, valor: centavos(Number(l.valor) || 0), ipi: centavos(Number(l.ipi) || 0) }));
  const somaValor = centavos(linhas.reduce((t, l) => t + l.valor, 0));
  const total = centavos(Math.max(Number(e.total) || 0, somaValor));
  const fora = centavos(total - somaValor);
  const frete = centavos(Number(e.frete) || 0), desconto = centavos(Number(e.desconto) || 0);
  // o que fica fora da lista entra como mais um peso; os centavos dele saem junto
  const pesos = fora > 0 ? [...linhas.map(l => l.valor), fora] : linhas.map(l => l.valor);
  const fretes = repartir(frete, pesos), descontos = repartir(desconto, pesos);
  const rateadas: LinhaRateada[] = linhas.map((l, i) => ({
    ...l,
    pct: total ? (l.valor * 100) / total : 0,
    frete: fretes[i], desconto: descontos[i],
    base: centavos(l.valor + l.ipi + fretes[i] - descontos[i]),
  }));
  const soma = (k: 'valor' | 'ipi' | 'frete' | 'desconto' | 'base') => centavos(rateadas.reduce((t, l) => t + l[k], 0));
  return {
    linhas: rateadas, total, frete, desconto,
    soma: { valor: soma('valor'), ipi: soma('ipi'), pct: rateadas.reduce((t, l) => t + l.pct, 0), frete: soma('frete'), desconto: soma('desconto'), base: soma('base') },
    foraDaLista: fora > 0 ? { valor: fora, frete: fretes[linhas.length], desconto: descontos[linhas.length] } : null,
  };
}

// ---------- pela nota do SIEG ----------

export type Tributacao = 'tributado' | 'st' | 'monofasico' | 'monofasico-st' | 'isento' | 'outras';
export const TRIBUTACOES: Record<Tributacao, string> = {
  tributado: 'Tributado', st: 'ICMS-ST', monofasico: 'Monofásico', 'monofasico-st': 'Monofásico e ST', isento: 'Isento / não tributado', outras: 'Outras',
};
const ORDEM: readonly Tributacao[] = ['tributado', 'st', 'monofasico', 'monofasico-st', 'isento', 'outras'];

// CST 40/41/50 (isenta, não tributada, suspensa) e CSOSN 103/300/400; CST 90 e CSOSN 900 = outras
const CST_ISENTO = ['40', '41', '50'];
const CSOSN_ISENTO = ['103', '300', '400'];

/** A tributação do item: ST e monofásico como no Simples; depois isento, outras e, o resto, tributado. */
export function tributacaoDoItem(it: Pick<ItemDoXml, 'cst' | 'cfop' | 'ncm'>): Tributacao {
  const st = temIcmsSt(it.cst, it.cfop), mono = !!grupoMonofasico(it.ncm);
  if (st && mono) return 'monofasico-st';
  if (st) return 'st';
  if (mono) return 'monofasico';
  const c = so(it.cst);
  const csosn = c.length === 4 ? c.slice(1) : c.length === 3 && ['101', '102', '103', '201', '202', '203', '300', '400', '500', '900'].includes(c) ? c : '';
  if (csosn) return CSOSN_ISENTO.includes(csosn) ? 'isento' : csosn === '900' ? 'outras' : 'tributado';
  const cst = c.slice(-2);
  if (CST_ISENTO.includes(cst)) return 'isento';
  if (cst === '90') return 'outras';
  return 'tributado';
}

/** Os valores da nota para o rateio: o total dos produtos (a soma dos itens), o frete e o desconto. */
export interface ValoresDaNota {
  total: number; frete: number; desconto: number;
  /**
   * o resumo antigo (antes de 22/10/2026) não guarda o frete e o desconto: aí vêm da diferença entre o valor da nota e os
   * produtos com o ST e o IPI (o que sobra vira frete; o que falta, desconto; seguro e outras despesas entram junto)
   */
  estimado: boolean;
}

export function valoresDaNota(n: NotaDoSieg): ValoresDaNota {
  const itens = n.itens || [];
  const total = centavos(itens.reduce((t, i) => t + (Number(i.valor) || 0), 0));
  if (n.frete !== undefined || n.desconto !== undefined) return { total, frete: centavos(n.frete || 0), desconto: centavos(n.desconto || 0), estimado: false };
  const resto = centavos((Number(n.valor) || 0) - total - itens.reduce((t, i) => t + (Number(i.st) || 0) + (Number(i.ipi) || 0), 0));
  if (!itens.length || !resto) return { total, frete: 0, desconto: 0, estimado: false };
  return { total, frete: resto > 0 ? resto : 0, desconto: resto < 0 ? -resto : 0, estimado: true };
}

/** Um grupo de itens da nota (uma tributação ou um CFOP), com os itens por NCM para o detalhe. */
export interface GrupoDaNota {
  id: string; rotulo: string;
  /** os CFOPs (na tributação) ou as tributações (no CFOP) do grupo */
  detalhe: string;
  valor: number; ipi: number;
  /** os itens somados por NCM (a segunda parte da planilha) */
  ncms: { ncm: string; valor: number; ipi: number }[];
}

export type AgruparPor = 'tributacao' | 'cfop';

/** Os itens da nota somados pela tributação (ou pelo CFOP), na ordem da tributação (ou do CFOP). */
export function gruposDaNota(n: NotaDoSieg, por: AgruparPor = 'tributacao'): GrupoDaNota[] {
  const grupos = new Map<string, { trib: Tributacao; valor: number; ipi: number; detalhes: Set<string>; ncms: Map<string, { valor: number; ipi: number }> }>();
  for (const it of n.itens || []) {
    const trib = tributacaoDoItem(it);
    const id = por === 'cfop' ? so(it.cfop) || 'sem CFOP' : trib;
    const g = grupos.get(id) || { trib, valor: 0, ipi: 0, detalhes: new Set<string>(), ncms: new Map() };
    const valor = Number(it.valor) || 0, ipi = Number(it.ipi) || 0;
    g.valor += valor; g.ipi += ipi;
    g.detalhes.add(por === 'cfop' ? TRIBUTACOES[trib] : so(it.cfop));
    const ncm = so(it.ncm) || 'sem NCM';
    const x = g.ncms.get(ncm) || { valor: 0, ipi: 0 };
    x.valor += valor; x.ipi += ipi;
    g.ncms.set(ncm, x);
    grupos.set(id, g);
  }
  return [...grupos]
    .map(([id, g]) => ({
      id, rotulo: por === 'cfop' ? id : TRIBUTACOES[g.trib],
      detalhe: [...g.detalhes].filter(Boolean).sort().join(', '),
      valor: centavos(g.valor), ipi: centavos(g.ipi),
      ncms: [...g.ncms].map(([ncm, x]) => ({ ncm, valor: centavos(x.valor), ipi: centavos(x.ipi) })).sort((a, b) => b.valor - a.valor || a.ncm.localeCompare(b.ncm)),
    }))
    .sort((a, b) => (por === 'cfop' ? a.id.localeCompare(b.id) : ORDEM.indexOf(a.id as Tributacao) - ORDEM.indexOf(b.id as Tributacao)));
}

/**
 * A segunda parte da planilha: o frete e o desconto que couberam a um grupo, repartidos pelos NCMs dele (base = valor +
 * IPI + frete − desconto). A soma dos NCMs bate com o frete e o desconto do grupo.
 */
export function rateioDosNcms(g: GrupoDaNota, frete: number, desconto: number): Rateio {
  return ratear({ total: g.valor, frete, desconto, linhas: g.ncms.map(x => ({ rotulo: x.ncm, valor: x.valor, ipi: x.ipi })) });
}

// ---------- pelo CT-e (23/10/2026: "preciso que o rateio seja da CTE não da nota dos produtos que vão ser transportados") ----------

export interface RateioDoCte {
  /** o valor do CT-e (a prestação, vTPrest) que se reparte */
  valor: number;
  /** as NF-e que ele leva, com a parte de cada uma no total dos produtos e o frete dela */
  notas: { chave: string; numero: string; emitente: string; produtos: number; pct: number; frete: number }[];
  /** os itens das notas juntos, pela tributação (ou pelo CFOP), para o rateio e o detalhe pelos NCMs */
  grupos: GrupoDaNota[];
  /** o valor do CT-e pelas tributações: a soma bate com o CT-e */
  rateio: Rateio;
}

/**
 * O frete de um CT-e repartido pelas NF-e que ele transporta, na proporção dos produtos de cada uma, e pelas tributações
 * dos itens delas (base = valor + IPI + frete). `valor` vazio = o do CT-e. Cada repartição fecha no centavo com o CT-e.
 */
export function rateioDoCte(cte: Pick<NotaDoSieg, 'valor'>, notas: readonly NotaDoSieg[], por: AgruparPor = 'tributacao', valor?: number): RateioDoCte {
  const v = centavos(valor ?? (Number(cte.valor) || 0));
  const produtos = notas.map(n => centavos((n.itens || []).reduce((t, i) => t + (Number(i.valor) || 0), 0)));
  const soma = centavos(produtos.reduce((t, p) => t + p, 0));
  const fretes = repartir(v, produtos);
  const juntas: NotaDoSieg | null = notas.length ? { ...notas[0], itens: notas.flatMap(n => n.itens || []) } : null;
  const grupos = juntas ? gruposDaNota(juntas, por) : [];
  return {
    valor: v,
    notas: notas.map((n, i) => ({ chave: n.chave, numero: n.numero, emitente: n.emitente.nome, produtos: produtos[i], pct: soma ? (produtos[i] * 100) / soma : 0, frete: fretes[i] })),
    grupos,
    rateio: ratear({ total: soma, frete: v, desconto: 0, linhas: grupos }),
  };
}
