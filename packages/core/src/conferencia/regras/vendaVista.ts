// Saídas: venda à vista (CPF / consumidor final) × a prazo (CNPJ), liga/desliga por empresa.
// Origem: conferencia.html ehCfopVenda/ehVendaVista/ctxVista (~L2137-2163),
// vistaRowCfop/vistaPendentes (~L2181-2213), lancEsperadoSaida/lancVistaDaNota (~L2806-2816).
import { docLimpo, lancN, nomeNorm } from '../../formatos';
import { CFOP_DESC } from '../tabelas/cfop';
import type { Empresa, GrupoNatureza, Nota } from '../tipos';
import { chaveNaturezaNota, tipoDoCfop } from './cfop';
import { naoContabil, todosGruposNatureza } from './empresa';

/** CFOP de venda (mercadorias e produtos), fora a venda de ativo imobilizado. */
export function ehCfopVenda(n: Pick<Nota, 'cfop'> & { desc?: string }): boolean {
  if (tipoDoCfop(n.cfop) !== 'Saída') return false;
  const d = nomeNorm(CFOP_DESC[n.cfop] || n.desc || '');
  return d.indexOf('venda') === 0 && d.indexOf('ativo imobilizado') < 0;
}

/** À vista: CPF no documento, "consumidor final" no nome, ou sem documento e sem nome. */
export function ehVendaVista(n: Pick<Nota, 'nome'> & { doc?: string }): boolean {
  const doc = docLimpo(n.doc);
  const nome = nomeNorm(n.nome);
  if (/^\d{11}$/.test(doc)) return true;
  if (nome.indexOf('consumidor final') > -1) return true;
  return !nome && !doc;
}

export interface ContextoVista {
  lancs: Record<string, string>;
  /** lançamento mais usado nas vendas à vista de cada natureza */
  maior: Record<string, string>;
  prazo: Record<string, string>;
}

/** Contexto das vendas à vista (null com a opção desligada). */
export function ctxVista(e: Empresa): ContextoVista | null {
  const v = e.vendaVista || { ativo: false, lancs: {} };
  if (!v.ativo) return null;
  const cont: Record<string, Record<string, number>> = {};
  const maior: Record<string, string> = {};
  for (const n of e.saidas) {
    if (!n.lanc || !ehCfopVenda(n) || !ehVendaVista(n)) continue;
    const k = chaveNaturezaNota(n, 'Saída');
    const l = lancN(n.lanc);
    const c = (cont[k] = cont[k] || {});
    c[l] = (c[l] || 0) + 1;
  }
  for (const k of Object.keys(cont)) for (const l of Object.keys(cont[k])) if (!maior[k] || cont[k][l] > cont[k][maior[k]]) maior[k] = l;
  return { lancs: v.lancs || {}, maior, prazo: v.prazo || {} };
}

export interface LancEsperado { lanc: string; origem: 'vista' | 'prazo'; cadastrado: boolean }

/** Venda à vista (com a opção ligada) é conferida contra o lançamento à vista, fora da maioria do CFOP. */
export function lancEsperadoSaida(n: Nota, ctx: ContextoVista | null): LancEsperado | null {
  if (!ctx || !ehCfopVenda(n)) return null;
  const k = chaveNaturezaNota(n, 'Saída');
  if (!ehVendaVista(n)) return ctx.prazo[k] ? { lanc: ctx.prazo[k], origem: 'prazo', cadastrado: true } : null;
  const l = ctx.lancs[k] || ctx.maior[k];
  return l ? { lanc: l, origem: 'vista', cadastrado: !!ctx.lancs[k] } : null;
}

export function lancVistaDaNota(n: Nota, ctx: ContextoVista | null): string | null {
  if (!ctx || !ehCfopVenda(n)) return null;
  const k = chaveNaturezaNota(n, 'Saída');
  return ctx.lancs[k] || ctx.maior[k] || null;
}

export function ehGrupoVenda(gr: Pick<GrupoNatureza, 'cfops' | 'desc'>): boolean {
  return gr.cfops.some(cf => ehCfopVenda({ cfop: cf, desc: gr.desc }));
}

export type TipoVista = 'vista' | 'prazo';
export const VISTA_TIPOS: readonly { t: TipoVista; rot: string }[] = [
  { t: 'vista', rot: 'Lançamento à vista' },
  { t: 'prazo', rot: 'Lançamento a prazo' },
];

export function vistaValor(e: Empresa, k: string, t: TipoVista): string {
  const v = e.vendaVista;
  return ((t === 'prazo' ? v.prazo : v.lancs) || {})[k] || '';
}

/** Linha de lançamentos à vista/a prazo de um CFOP de venda: quantidades e sugestão (o mais usado). */
export function resumoVistaDoGrupo(e: Empresa, k: string, gr: GrupoNatureza) {
  const cont: Record<TipoVista, Record<string, number>> = { vista: {}, prazo: {} };
  const qtd: Record<TipoVista, number> = { vista: 0, prazo: 0 };
  const sug: Partial<Record<TipoVista, string>> = {};
  for (const n of gr.itens) {
    const t: TipoVista = ehVendaVista(n) ? 'vista' : 'prazo';
    qtd[t]++;
    const l = lancN(n.lanc);
    if (l) cont[t][l] = (cont[t][l] || 0) + 1;
  }
  for (const t of ['vista', 'prazo'] as TipoVista[]) {
    const fora = t === 'prazo' ? lancN(vistaValor(e, k, 'vista')) : '';
    for (const l of Object.keys(cont[t])) if (l !== fora && (!sug[t] || cont[t][l] > cont[t][sug[t] as string])) sug[t] = l;
  }
  return { qtd, sug };
}

/** CFOPs de venda sem o lançamento à vista ou a prazo (com a opção ligada). */
export function vistaPendentes(e: Empresa): { k: string; t: TipoVista }[] {
  const out: { k: string; t: TipoVista }[] = [];
  if (!e.vendaVista.ativo) return out;
  const g = todosGruposNatureza(e);
  for (const k of Object.keys(g)) {
    if (g[k].tipo !== 'Saída' || !ehGrupoVenda(g[k]) || naoContabil(e, k)) continue;
    for (const o of VISTA_TIPOS) if (!vistaValor(e, k, o.t)) out.push({ k, t: o.t });
  }
  return out;
}

/** Saídas guardadas sem a coluna CPF/CNPJ (importadas antes dela existir). */
export function saidasSemDocumento(e: Empresa): boolean {
  return !!e.saidas.length && !e.saidas.some(n => n.doc != null);
}
