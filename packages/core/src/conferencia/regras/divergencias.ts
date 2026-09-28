// Lançamento fora do padrão do CFOP: o padrão é o lançamento da maioria das notas
// daquele CFOP (≥ 60%, com pelo menos 3 notas), ou o cadastrado na venda à vista/a prazo.
// Origem: conferencia.html padraoPorCfop/acharDivergencias (~L2817-2849).
import { lancN } from '../../formatos';
import type { Empresa, Nota, TipoNotaFiscal } from '../tipos';
import { chaveNota } from './cfop';
import { ctxVista, lancEsperadoSaida, lancVistaDaNota } from './vendaVista';

/** Mínimo de notas no CFOP para existir padrão. */
export const MIN_NOTAS_PADRAO = 3;
/** Fração mínima do lançamento dominante para virar padrão. */
export const FRACAO_PADRAO = 0.6;

export interface PadraoCfop { lanc: string; qtd: number; total: number }

export function padraoPorCfop(e: Empresa, tipo: TipoNotaFiscal): Record<string, PadraoCfop> {
  const g: Record<string, Record<string, number>> = {};
  const ctx = tipo === 'saidas' ? ctxVista(e) : null;
  for (const n of e[tipo]) {
    if (!n.cfop || !n.lanc) continue;
    if (lancEsperadoSaida(n, ctx)) continue; // venda à vista: conferida à parte
    const lv = lancVistaDaNota(n, ctx);
    if (lv && lancN(n.lanc) === lancN(lv)) continue; // CNPJ com lançamento à vista não vira padrão
    if (!g[n.cfop]) g[n.cfop] = {};
    g[n.cfop][n.lanc] = (g[n.cfop][n.lanc] || 0) + 1;
  }
  const dom: Record<string, PadraoCfop> = {};
  for (const cfop of Object.keys(g)) {
    let best = '';
    let bestQtd = 0;
    let total = 0;
    for (const l of Object.keys(g[cfop])) {
      total += g[cfop][l];
      if (g[cfop][l] > bestQtd) { bestQtd = g[cfop][l]; best = l; }
    }
    dom[cfop] = { lanc: best, qtd: bestQtd, total };
  }
  return dom;
}

export interface Divergencia {
  nota: Nota;
  chave: string;
  /** lançamento esperado */
  padrao: string;
  /** esperado veio do cadastro (à vista/a prazo) e não da maioria */
  cadastrado?: boolean;
  origem?: 'vista' | 'prazo' | 'cnpjVista';
  qtdPadrao?: number;
  totalCfop?: number;
}

export function acharDivergencias(e: Empresa, tipo: TipoNotaFiscal): Divergencia[] {
  const dom = padraoPorCfop(e, tipo);
  const out: Divergencia[] = [];
  const ctx = tipo === 'saidas' ? ctxVista(e) : null;
  for (const n of e[tipo]) {
    if (!n.cfop || !n.lanc) continue;
    const esp = lancEsperadoSaida(n, ctx);
    if (esp) {
      if (lancN(n.lanc) !== lancN(esp.lanc)) out.push({ nota: n, chave: chaveNota(n), padrao: esp.lanc, origem: esp.origem, cadastrado: esp.cadastrado });
      continue;
    }
    const d = dom[n.cfop];
    const lv = lancVistaDaNota(n, ctx);
    if (lv && lancN(n.lanc) === lancN(lv)) { out.push({ nota: n, chave: chaveNota(n), padrao: (d && d.lanc) || '—', origem: 'cnpjVista' }); continue; }
    if (!d || d.total < MIN_NOTAS_PADRAO) continue;
    if (n.lanc !== d.lanc && d.qtd / d.total >= FRACAO_PADRAO) out.push({ nota: n, chave: chaveNota(n), padrao: d.lanc, qtdPadrao: d.qtd, totalCfop: d.total });
  }
  return out;
}

/** Marca de "corrigido" de uma nota fora do padrão. */
export function chaveResolvido(tipo: TipoNotaFiscal, chave: string): string {
  return tipo + '|' + chave;
}
