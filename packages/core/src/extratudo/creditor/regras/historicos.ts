// Os históricos do Creditor (o código do histórico do principal, da mora e do desconto) valem para todas as empresas
// (Vitor, 05/10/2026: "uma aba de configurações dentro do contábil, só para configurar históricos"): ficam num lugar só
// e passam por cima do que cada empresa tinha.
import { CONTAS_PADRAO, type ContasCreditor } from '../tipos';

export type Historicos = Pick<ContasCreditor, 'histPrincipal' | 'histJuros' | 'histDesconto'>;
export type CampoHistorico = keyof Historicos;

export const CAMPOS_HISTORICO: readonly CampoHistorico[] = ['histPrincipal', 'histJuros', 'histDesconto'];

export const HISTORICOS_PADRAO: Historicos = {
  histPrincipal: CONTAS_PADRAO.histPrincipal, histJuros: CONTAS_PADRAO.histJuros, histDesconto: CONTAS_PADRAO.histDesconto,
};

/** O documento guardado → os históricos (o que faltar, o padrão). */
export function historicosDoDocumento(d: unknown): Historicos {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const ler = (k: CampoHistorico) => (typeof o[k] === 'string' && (o[k] as string).trim() ? (o[k] as string).trim() : HISTORICOS_PADRAO[k]);
  return { histPrincipal: ler('histPrincipal'), histJuros: ler('histJuros'), histDesconto: ler('histDesconto') };
}

/** As contas da empresa com os históricos do escritório por cima. */
export function comHistoricos(contas: ContasCreditor, h: Historicos): ContasCreditor {
  return { ...contas, ...h };
}

export function mesmosHistoricos(a: Historicos, b: Historicos): boolean {
  return CAMPOS_HISTORICO.every(k => a[k] === b[k]);
}
