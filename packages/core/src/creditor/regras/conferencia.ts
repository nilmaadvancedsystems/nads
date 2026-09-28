// Conferência dos grupos do relatório do banco (passo 2 do fluxo): a soma do que foi extraído
// tem que bater, centavo a centavo, com o total impresso no próprio relatório. É a proteção contra
// dígito lido errado. Também confere, linha a linha, cobrado = valor + mora − desconto.
import type { ColunaValor, Grupo, RelatorioBanco, Titulo, TotaisImpressos } from '../tipos';
import { igual, liquidoDoTitulo, ordemData, r2, somar } from './numeros';

export const COLUNAS_VALOR: readonly ColunaValor[] = ['valor', 'mora', 'desconto', 'cobrado'];

export const ROTULO_COLUNA: Record<ColunaValor, string> = {
  valor: 'Valor (R$)', mora: 'Vlr. Mora', desconto: 'Vlr. Desc.', cobrado: 'Vlr. Cobrado',
};

export interface ConferenciaColuna {
  coluna: ColunaValor;
  soma: number;
  impresso: number | null;
  /** soma − impresso (null quando não há impresso) */
  diferenca: number | null;
}

export type SituacaoGrupo = 'ok' | 'diverge' | 'sem-total';

export interface ConferenciaGrupo {
  grupoId: number;
  datas: string[];
  colunas: ConferenciaColuna[];
  /** títulos em que cobrado ≠ valor + mora − desconto */
  incoerentes: number[];
  situacao: SituacaoGrupo;
}

export function somaDaColuna(titulos: Titulo[], c: ColunaValor): number {
  return somar(titulos.map(t => (c === 'cobrado' ? liquidoDoTitulo(t) : t[c])));
}

/** O título fecha consigo mesmo? (só dá para saber quando o relatório traz o cobrado) */
export function tituloCoerente(t: Titulo): boolean {
  return t.cobrado == null || igual(t.cobrado, r2(t.valor + t.mora - t.desconto));
}

export function datasDoGrupo(g: Grupo): string[] {
  return [...new Set(g.titulos.map(t => t.liquidacao))].sort((a, b) => ordemData(a) - ordemData(b));
}

export function conferirColunas(titulos: Titulo[], impresso: TotaisImpressos): ConferenciaColuna[] {
  return COLUNAS_VALOR.map(c => {
    const soma = somaDaColuna(titulos, c);
    const imp = impresso[c];
    return { coluna: c, soma, impresso: imp, diferenca: imp == null ? null : r2(soma - imp) };
  });
}

/**
 * Grupo validado = pelo menos um total impresso, todos os impressos batendo e nenhuma linha incoerente.
 * Sem total impresso ("sem-total"), a pessoa precisa digitar o total do papel para seguir.
 */
export function conferirGrupo(g: Grupo): ConferenciaGrupo {
  const colunas = conferirColunas(g.titulos, g.impresso);
  const incoerentes = g.titulos.filter(t => !tituloCoerente(t)).map(t => t.id);
  const comTotal = colunas.filter(c => c.impresso != null);
  const situacao: SituacaoGrupo = incoerentes.length || comTotal.some(c => !igual(c.diferenca || 0, 0)) ? 'diverge'
    : comTotal.length === 0 ? 'sem-total' : 'ok';
  return { grupoId: g.id, datas: datasDoGrupo(g), colunas, incoerentes, situacao };
}

export interface ConferenciaGeral {
  colunas: ConferenciaColuna[];
  /** true = bate ou não veio total geral */
  ok: boolean;
}

/** "Total de Valores Liquidados" contra a soma de todos os grupos. */
export function conferirTotalGeral(r: RelatorioBanco): ConferenciaGeral {
  const colunas = conferirColunas(r.grupos.flatMap(g => g.titulos), r.totalGeral);
  return { colunas, ok: colunas.every(c => c.diferenca == null || igual(c.diferenca, 0)) };
}

/** Tudo pronto para cruzar com o sistema: todo grupo "ok" e o total geral batendo. */
export function relatorioConferido(r: RelatorioBanco): boolean {
  const titulos = r.grupos.flatMap(g => g.titulos);
  return titulos.length > 0 && r.grupos.every(g => g.titulos.length === 0 || conferirGrupo(g).situacao === 'ok') && conferirTotalGeral(r).ok;
}
