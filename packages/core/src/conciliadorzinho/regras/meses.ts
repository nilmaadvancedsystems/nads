// Competências (meses): contagem, chave, slug do nome do arquivo e comparação cartão × vendas.
// Origem: conciliadorZINHO.html computeMonthTally (~L985), monthKey (~L997),
// wireStep2 — extraSalesMonths/intersectionMonths/excludedMonths (~L1410-1423),
// monthOfDateKey (~L1632) e monthsSlug (~L1805).
import type { Mes, MesContagem } from '../tipos';
import { pad2 } from './formatos';

/** Quantos itens caem em cada mês, em ordem cronológica (computeMonthTally). */
export function contarMeses(itens: { data: Date }[]): MesContagem[] {
  const conta: Record<string, MesContagem> = {};
  for (const it of itens) {
    const k = it.data.getFullYear() + '-' + (it.data.getMonth() + 1);
    if (!conta[k]) conta[k] = { mes: it.data.getMonth() + 1, ano: it.data.getFullYear(), qtd: 0 };
    conta[k].qtd++;
  }
  return Object.keys(conta).map(k => conta[k]).sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes));
}

/** 'aaaa-m' sem zero à esquerda (monthKey). Atenção: ordenar essas chaves como texto põe '2026-10' antes de '2026-9', como o original. */
export function chaveMes(m: Mes): string {
  return m.ano + '-' + m.mes;
}

/** 'dd/mm/aaaa' → 'aaaa-m', a mesma forma de chaveMes (monthOfDateKey). */
export function chaveMesDaData(chaveData: string): string {
  const p = chaveData.split('/');
  return parseInt(p[2], 10) + '-' + parseInt(p[1], 10);
}

/** Pedaço dos meses no nome do arquivo: '2026-07_2026-08'; mais de 4 vira '..._e-mais-N' (monthsSlug). */
export function slugMeses(ms: Mes[]): string {
  let partes = ms.map(m => m.ano + '-' + pad2(m.mes));
  if (partes.length > 4) partes = partes.slice(0, 4).concat(['e-mais-' + (ms.length - 4)]);
  return partes.join('_');
}

/**
 * Compara os meses dos extratos com os da planilha de vendas (wireStep2):
 * - extras: meses das vendas que o cartão não cobre;
 * - comuns: interseção, na ordem dos meses do cartão;
 * - excluidos: meses do cartão sem vendas.
 * No original: sem extras → concilia tudo (mesesPermitidos = null, nenhum excluído);
 * com extras e sem comuns → "Nenhum mês em comum" (não deixa seguir);
 * com extras e comuns → pergunta e, se prosseguir, mesesPermitidos = comuns e os excluídos
 * viram o aviso "ficaram de fora".
 */
export function compararMeses(mesesCartao: Mes[], mesesVendas: Mes[]): { extras: Mes[]; comuns: Mes[]; excluidos: Mes[] } {
  const doCartao: Record<string, true> = {};
  mesesCartao.forEach(m => { doCartao[chaveMes(m)] = true; });
  const dasVendas: Record<string, true> = {};
  mesesVendas.forEach(m => { dasVendas[chaveMes(m)] = true; });
  return {
    extras: mesesVendas.filter(m => !doCartao[chaveMes(m)]),
    comuns: mesesCartao.filter(m => dasVendas[chaveMes(m)]),
    excluidos: mesesCartao.filter(m => !dasVendas[chaveMes(m)]),
  };
}

/**
 * Filtro por mês: null ou lista vazia = todos. Usado na conciliação e na conferência dos totais,
 * para os dois olharem os MESMOS meses (corrigido no nads: o original filtrava só o cartão).
 */
export function noPeriodo(mesesPermitidos: Mes[] | null): (d: Date) => boolean {
  if (!mesesPermitidos || !mesesPermitidos.length) return () => true;
  const ok = new Set(mesesPermitidos.map(chaveMes));
  return d => ok.has(d.getFullYear() + '-' + (d.getMonth() + 1));
}

/** Ordena chaves 'aaaa-m' pelo calendário (corrigido no nads: o original punha '2026-10' antes de '2026-9'). */
export function porCalendario(a: string, b: string): number {
  const [aa, am] = a.split('-').map(Number);
  const [ba, bm] = b.split('-').map(Number);
  return (aa - ba) || (am - bm);
}
