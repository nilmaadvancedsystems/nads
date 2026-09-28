// Lançamentos automáticos (de-para lançamento → conta; tela fora do menu).
// Origem: conferencia.html lancsDescobertos/palavrasSignificativas/melhorConta/linhasDp
// (~L2644-2710), btAutoLanc (~L2762).
import { compararNumerico, normalizarTexto } from '../../formatos';
import { CFOP_DESC } from '../tabelas/cfop';
import type { Conta, Empresa } from '../tipos';

const STOPWORDS_CONTA = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'os', 'as', 'para', 'com', 'em', 'no', 'na', 'ou', 'um', 'uma'];
/** Nota mínima para sugerir uma conta pelo nome. */
export const NOTA_MIN_SUGESTAO = 0.34;

function palavrasSignificativas(s: string): string[] {
  return normalizarTexto(s).split(' ').filter(w => w.length > 2 && STOPWORDS_CONTA.indexOf(w) === -1);
}

/** Conta cujo nome mais parece com a natureza do CFOP (ou null). */
export function melhorConta(natureza: string, contas: Conta[]): Conta | null {
  const palavras = palavrasSignificativas(natureza);
  if (!palavras.length) return null;
  let melhor: Conta | null = null;
  let melhorScore = 0;
  for (const c of contas) {
    const nomeN = normalizarTexto(c.nome);
    const palavrasConta = palavrasSignificativas(c.nome);
    if (!palavrasConta.length) continue;
    const acertos = palavras.filter(w => nomeN.indexOf(w.slice(0, Math.max(4, Math.ceil(w.length * 0.7)))) > -1).length;
    // frases de CFOP são mais longas que o nome da conta: compara com o lado mais curto
    const score = acertos / Math.min(palavras.length, palavrasConta.length);
    if (score > melhorScore) { melhorScore = score; melhor = c; }
  }
  return melhorScore >= NOTA_MIN_SUGESTAO ? melhor : null;
}

export interface LinhaDp { lanc: string; cfops: string[]; natureza: string; qtd: number; conta: string; nome: string; dc: 'D' | 'C' }

/** Lançamentos achados nas notas + os já cadastrados. */
export function linhasDp(e: Empresa): LinhaDp[] {
  const porLanc: Record<string, { cfops: Record<string, number>; qtd: number }> = {};
  for (const n of e.entradas.concat(e.saidas)) {
    if (!n.lanc) continue;
    const x = (porLanc[n.lanc] = porLanc[n.lanc] || { cfops: {}, qtd: 0 });
    x.cfops[n.cfop] = (x.cfops[n.cfop] || 0) + 1;
    x.qtd++;
  }
  const todos: Record<string, { cfops: string[]; natureza: string; qtd: number }> = {};
  for (const l of Object.keys(porLanc)) {
    const info = porLanc[l];
    const dom = Object.keys(info.cfops).sort((a, b) => info.cfops[b] - info.cfops[a])[0];
    todos[l] = { cfops: Object.keys(info.cfops), natureza: CFOP_DESC[dom] || '', qtd: info.qtd };
  }
  const porLancDp: Record<string, Empresa['dp'][number]> = {};
  for (const l of e.dp) if (l.lanc) { porLancDp[l.lanc] = l; if (!todos[l.lanc]) todos[l.lanc] = { cfops: [], natureza: '', qtd: 0 }; }
  return Object.keys(todos).sort(compararNumerico).map(lanc => {
    const d = todos[lanc];
    const l = porLancDp[lanc];
    return { lanc, cfops: d.cfops, natureza: d.natureza, qtd: d.qtd, conta: l ? l.conta : '', nome: l ? l.nome : '', dc: l ? l.dc : 'D' };
  });
}

/** Preenche sozinho os pendentes cuja natureza parece com o nome de uma conta livre. */
export function sugerirLancamentos(e: Empresa): { lanc: string; conta: Conta }[] {
  const usadas: Record<string, 1> = {};
  for (const l of e.dp) if (l.conta) usadas[l.conta] = 1;
  let livres = e.contas.filter(c => !c.sintetica && !usadas[c.codigo]);
  const out: { lanc: string; conta: Conta }[] = [];
  for (const l of linhasDp(e).filter(x => !x.conta)) {
    if (!l.natureza) continue;
    const c = melhorConta(l.natureza, livres);
    if (c) { out.push({ lanc: l.lanc, conta: c }); livres = livres.filter(x => x.codigo !== c.codigo); }
  }
  return out;
}
