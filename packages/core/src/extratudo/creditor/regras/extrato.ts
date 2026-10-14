// O Creditor obedece o extrato (Vitor, 14/10/2026: "dia 09/02 não tem esse lançamento… faça ele obedecer exclusivamente
// o extrato"). O relatório de liquidação traz títulos que o banco não creditou na conta (ou creditou noutro
// dia); com eles, o razão ficava com o valor deles a mais desde a data. Agora cada CRÉD.LIQUIDAÇÃO COBRANÇA do extrato é
// casado com os títulos do relatório que somam exatamente o valor dele, liquidados no dia ou até JANELA_DIAS antes:
//   1. os títulos de um dia só (o mais perto primeiro);
//   2. os de dias seguidos (o banco juntou dias num crédito);
//   3. uma parte dos títulos da janela (o resto não foi creditado).
// O título casado entra no .xls com a data do crédito; o que não casou com nenhum crédito fica fora (o banco não pagou ele
// nesta conta). O mês sem extrato importado não é filtrado (fica como antes: a data e os títulos do relatório).
import type { Titulo } from '../tipos';
import { liquidoDoTitulo } from './numeros';

/** Um CRÉD.LIQUIDAÇÃO COBRANÇA do extrato. */
export interface CreditoDeLiquidacao {
  /** DD/MM/AAAA */
  data: string;
  /** em reais */
  valor: number;
  historico: string;
}

/** O lançamento do extrato como o Extrator guarda: a data em AAAA-MM-DD e o valor em centavos (+ entrou). */
export interface LancamentoDoExtrato { data: string; valor: number; historico: string }

const CREDLIQ = /\bcred\s*\.?\s*liq/;
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Os créditos de liquidação de cobrança do extrato (CRÉD.LIQ.COBRANÇA, CRÉD.LIQUIDAÇÃO COBRANÇA…), em ordem de data. */
export function creditosDeLiquidacao(lancamentos: readonly LancamentoDoExtrato[]): CreditoDeLiquidacao[] {
  return lancamentos
    .filter(l => l.valor > 0 && CREDLIQ.test(norm(l.historico)))
    .map(l => ({ data: l.data.slice(8, 10) + '/' + l.data.slice(5, 7) + '/' + l.data.slice(0, 4), valor: l.valor / 100, historico: l.historico }))
    .sort((a, b) => dia(a.data) - dia(b.data));
}

/** Quantos dias antes do crédito o título pode ter sido liquidado. */
export const JANELA_DIAS = 7;
/** Acima disso (em centavos) não tenta a parte dos títulos (a conta ficaria pesada). */
const MAX_PARTE = 5_000_000;

function dia(d: string): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) / 864e5 : NaN;
}

export interface CasamentoComExtrato {
  /** o título → a data do crédito no extrato (DD/MM/AAAA) */
  dataDoCredito: Map<number, string>;
  /** cada crédito do extrato e os títulos dele (vazio = nenhum título do relatório soma o valor) */
  creditos: { credito: CreditoDeLiquidacao; titulos: number[] }[];
  /** os títulos que o banco não creditou (ficam fora do .xls) */
  semCredito: Titulo[];
}

const centavos = (t: Titulo) => Math.round(liquidoDoTitulo(t) * 100);
const soma = (ts: readonly Titulo[]) => ts.reduce((s, t) => s + centavos(t), 0);

/** Os títulos (da lista, na ordem dela) que somam o alvo; null = nenhuma combinação. */
function parteQueSoma(ts: readonly Titulo[], alvo: number): Titulo[] | null {
  if (alvo <= 0 || alvo > MAX_PARTE || !ts.length || ts.length >= 65535) return null;
  const vals = ts.map(centavos);
  // quem chegou primeiro em cada soma (índice + 1); os da frente (os mais perto do crédito) têm a preferência
  const por = new Uint16Array(alvo + 1);
  const alcancada = new Uint8Array(alvo + 1);
  alcancada[0] = 1;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v <= 0 || v > alvo) continue;
    for (let s = alvo; s >= v; s--) {
      if (!alcancada[s] && alcancada[s - v]) { alcancada[s] = 1; por[s] = i + 1; }
    }
    if (alcancada[alvo]) break;
  }
  if (!alcancada[alvo]) return null;
  const escolha: Titulo[] = [];
  for (let s = alvo; s > 0;) { const i = por[s] - 1; escolha.push(ts[i]); s -= vals[i]; }
  return escolha;
}

/**
 * Casa os títulos com os créditos do extrato. `mesesComExtrato` ('AAAA-MM'): os meses em que o extrato da conta está
 * importado; o título liquidado num mês sem extrato não casou com nada e fica com a data dele (não sai do arquivo).
 */
export function casarComExtrato(titulos: readonly Titulo[], creditos: readonly CreditoDeLiquidacao[], mesesComExtrato: readonly string[]): CasamentoComExtrato {
  const livres = new Set(titulos.map(t => t.id));
  const dataDoCredito = new Map<number, string>();
  const saida: CasamentoComExtrato['creditos'] = [];
  for (const c of [...creditos].sort((a, b) => dia(a.data) - dia(b.data))) {
    const alvo = Math.round(c.valor * 100);
    const d = dia(c.data);
    const janela = titulos.filter(t => livres.has(t.id) && dia(t.liquidacao) <= d && d - dia(t.liquidacao) <= JANELA_DIAS);
    // os dias da janela, do mais perto do crédito para o mais longe
    const dias = [...new Set(janela.map(t => t.liquidacao))].sort((a, b) => dia(b) - dia(a)).map(x => janela.filter(t => t.liquidacao === x));
    let escolha: readonly Titulo[] | null = dias.find(ts => soma(ts) === alvo) || null;
    for (let i = 0; !escolha && i < dias.length; i++) {
      let acc = 0;
      for (let j = i; j < dias.length; j++) {
        acc += soma(dias[j]);
        if (j > i && acc === alvo) { escolha = dias.slice(i, j + 1).flat(); break; }
        if (acc > alvo) break;
      }
    }
    if (!escolha) escolha = parteQueSoma(dias.flat(), alvo);
    for (const t of escolha || []) { livres.delete(t.id); dataDoCredito.set(t.id, c.data); }
    saida.push({ credito: c, titulos: (escolha || []).map(t => t.id) });
  }
  const comExtrato = new Set(mesesComExtrato);
  const mes = (t: Titulo) => t.liquidacao.slice(6, 10) + '-' + t.liquidacao.slice(3, 5);
  const semCredito = titulos.filter(t => livres.has(t.id) && comExtrato.has(mes(t)));
  return { dataDoCredito, creditos: saida, semCredito };
}

// ─── Títulos descontados (TD) ─────────────────────────────────────────────────
// Vitor, 14/10/2026: os títulos "sem crédito" de uma empresa eram descontados. O banco adiantou o dinheiro antes
// ("CRÉD.LIBERAÇÃO TD": a liberação soma os títulos descontados) e, quando o cliente
// paga, fica com ele: não há CRÉD.LIQ.COBRANÇA. Esses títulos continuam fora do .xls (não mexem no banco), mas a tela
// diz de qual TD cada um veio, para não parecer erro.

/** Quantos dias depois da liberação do TD o título pode ser liquidado. */
export const JANELA_TD_DIAS = 120;

/** As liberações de desconto de títulos do extrato (CRÉD.LIBERAÇÃO TD), em ordem de data. */
export function liberacoesDeTD(lancamentos: readonly LancamentoDoExtrato[]): CreditoDeLiquidacao[] {
  return lancamentos
    .filter(l => l.valor > 0 && /\bliberacao\s+(de\s+)?td\b/.test(norm(l.historico)))
    .map(l => ({ data: l.data.slice(8, 10) + '/' + l.data.slice(5, 7) + '/' + l.data.slice(0, 4), valor: l.valor / 100, historico: l.historico }))
    .sort((a, b) => dia(a.data) - dia(b.data));
}

/**
 * De qual TD veio cada título sem crédito: primeiro os que somam exatamente uma liberação (liquidados depois dela, até
 * JANELA_TD_DIAS); depois, um a um, na primeira liberação anterior que ainda tem saldo (o TD pode ter títulos que vencem
 * fora do período). O que não cabe em nenhum fica sem explicação.
 */
export function titulosDescontados(titulos: readonly Titulo[], tds: readonly CreditoDeLiquidacao[]): Map<number, CreditoDeLiquidacao> {
  const de = new Map<number, CreditoDeLiquidacao>();
  const ordem = [...titulos].sort((a, b) => dia(a.liquidacao) - dia(b.liquidacao) || a.id - b.id);
  const cabe = (t: Titulo, td: CreditoDeLiquidacao) => dia(t.liquidacao) >= dia(td.data) && dia(t.liquidacao) - dia(td.data) <= JANELA_TD_DIAS;
  const saldo = new Map(tds.map(td => [td, Math.round(td.valor * 100)]));
  for (const td of tds) {
    const escolha = parteQueSoma(ordem.filter(t => !de.has(t.id) && cabe(t, td)), saldo.get(td) || 0);
    for (const t of escolha || []) de.set(t.id, td);
    if (escolha) saldo.set(td, 0);
  }
  for (const t of ordem) {
    if (de.has(t.id)) continue;
    const td = tds.find(x => cabe(t, x) && (saldo.get(x) || 0) >= centavos(t));
    if (td) { de.set(t.id, td); saldo.set(td, (saldo.get(td) || 0) - centavos(t)); }
  }
  return de;
}
