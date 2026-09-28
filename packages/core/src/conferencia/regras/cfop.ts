// CFOP e naturezas: tipo pelo primeiro dígito, chave da natureza e agrupamentos.
// Origem: conferencia.html tipoDoCfop (~L3343), DESC_AMBOS (~L3349),
// chaveNaturezaNota (~L2798), agruparTotaisPorNatureza (~L3355),
// agruparPorNatureza/ordenarGrupos (~L3153-3179), chave (~L2789).
import { compararNumerico, dataOrdem } from '../../formatos';
import { CFOP_DESC } from '../tabelas/cfop';
import type { GrupoNatureza, Nota, NotaComTipo, TipoCfop } from '../tipos';

/** CFOP 1xxx, 2xxx, 3xxx = entrada; 5xxx, 6xxx, 7xxx = saída. */
export function tipoDoCfop(cfop: string | null | undefined): TipoCfop | null {
  const c = String(cfop || '').trim().charAt(0);
  return c === '1' || c === '2' || c === '3' ? 'Entrada' : c === '5' || c === '6' || c === '7' ? 'Saída' : null;
}

/** Descrições que existem em CFOP de entrada E de saída (ex.: Frete Comercial 1353/5353):
 *  sem separar, entrada e saída cairiam no mesmo grupo e somariam juntas. */
export const DESC_AMBOS: Readonly<Record<string, true>> = (() => {
  const t: Record<string, Partial<Record<TipoCfop, 1>>> = {};
  const r: Record<string, true> = {};
  for (const c of Object.keys(CFOP_DESC)) {
    const d = CFOP_DESC[c];
    const tp = tipoDoCfop(c);
    if (tp) (t[d] = t[d] || {})[tp] = 1;
  }
  for (const d of Object.keys(t)) if (t[d].Entrada && t[d]['Saída']) r[d] = true;
  return r;
})();

/** Descrição do CFOP: a oficial ou, sem ela, a que veio no arquivo. */
export function descDoCfop(cfop: string, descArquivo?: string): string {
  return CFOP_DESC[cfop] || descArquivo || '';
}

/** Chave da natureza de CFOP de uma nota (o que o Cadastro liga às contas). */
export function chaveNaturezaNota(n: Pick<Nota, 'cfop' | 'desc'> & { tipo?: TipoCfop }, tipoPadrao?: TipoCfop): string {
  const tipo = tipoDoCfop(n.cfop) || n.tipo || tipoPadrao;
  const desc = CFOP_DESC[n.cfop] || n.desc || '';
  let key = desc || 'cfop:' + n.cfop;
  if (desc && DESC_AMBOS[desc]) key = desc + ' (' + (tipo === 'Entrada' ? 'entrada' : 'saída') + ')';
  return key;
}

/** Identidade de uma nota fiscal (dedupe na importação e marca de "corrigido"). */
export function chaveNota(n: Pick<Nota, 'cfop' | 'numero' | 'data' | 'valor'>): string {
  return [n.cfop, n.numero, n.data, n.valor.toFixed(2)].join('|');
}

/** Entradas + saídas com o tipo do CFOP resolvido. */
export function comTipo(entradas: Nota[], saidas: Nota[]): NotaComTipo[] {
  return entradas.map(n => ({ ...n, tipo: tipoDoCfop(n.cfop) || 'Entrada' } as NotaComTipo))
    .concat(saidas.map(n => ({ ...n, tipo: tipoDoCfop(n.cfop) || 'Saída' } as NotaComTipo)));
}

/** Agrupa notas pela natureza de CFOP (chave do Cadastro). */
export function agruparTotaisPorNatureza(notas: NotaComTipo[]): Record<string, GrupoNatureza> {
  const g: Record<string, GrupoNatureza> = {};
  for (const n of notas) {
    const tipo = (tipoDoCfop(n.cfop) || n.tipo) as TipoCfop;
    const desc = CFOP_DESC[n.cfop] || n.desc || '';
    const key = chaveNaturezaNota(n);
    if (!g[key]) g[key] = { desc, cfops: [], itens: [], tipo };
    if (g[key].cfops.indexOf(n.cfop) < 0) g[key].cfops.push(n.cfop);
    g[key].itens.push(n);
  }
  return g;
}

/** "1102, 1403 — Compra para comercialização" */
export function tituloDoGrupo(gr: { cfops: string[]; desc: string }): string {
  const cfops = gr.cfops.slice().sort(compararNumerico);
  return cfops.join(', ') + (gr.desc ? ' — ' + gr.desc : '');
}

export function somaValores(itens: { valor: number }[]): number {
  return itens.reduce((s, n) => s + n.valor, 0);
}

/** Ordena as chaves de naturezas pelo menor CFOP do grupo. */
export function ordenarPorCfop(grupos: Record<string, { cfops: string[] }>): string[] {
  return Object.keys(grupos).sort((a, b) => {
    const ga = grupos[a].cfops.slice().sort()[0] || '';
    const gb = grupos[b].cfops.slice().sort()[0] || '';
    return compararNumerico(ga, gb);
  });
}

// ---- agrupamento das notas fora do padrão (itens = { nota }) ----
export interface ItemComNota { nota: Nota }
export interface GrupoDeItens<T extends ItemComNota> { key: string; desc: string; cfops: string[]; itens: T[] }
export type OrdemGrupos = 'cfop' | 'valor' | 'data';

export function agruparPorNatureza<T extends ItemComNota>(lista: T[]): Record<string, { desc: string; cfops: string[]; itens: T[] }> {
  const g: Record<string, { desc: string; cfops: string[]; itens: T[] }> = {};
  for (const d of lista) {
    const cfop = d.nota.cfop;
    const desc = CFOP_DESC[cfop] || d.nota.desc || '';
    const key = desc || 'cfop:' + cfop;
    if (!g[key]) g[key] = { desc, cfops: [], itens: [] };
    if (g[key].cfops.indexOf(cfop) < 0) g[key].cfops.push(cfop);
    g[key].itens.push(d);
  }
  return g;
}

export function ordenarGrupos<T extends ItemComNota>(g: Record<string, { desc: string; cfops: string[]; itens: T[] }>, ordem: OrdemGrupos): GrupoDeItens<T>[] {
  const somaG = (k: string) => g[k].itens.reduce((s, d) => s + d.nota.valor, 0);
  const minData = (k: string) => Math.min(...g[k].itens.map(d => dataOrdem(d.nota.data)));
  return Object.keys(g).sort((a, b) => {
    if (ordem === 'valor') return somaG(b) - somaG(a);
    if (ordem === 'data') return minData(a) - minData(b);
    const ca = g[a].cfops.slice().sort()[0] || '';
    const cb = g[b].cfops.slice().sort()[0] || '';
    return compararNumerico(ca, cb);
  }).map(k => ({ key: k, ...g[k] }));
}
