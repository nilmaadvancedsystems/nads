// A rotina de cada departamento: Contábil, o Fiscal (05/10/2026) e o DP (06/10/2026, o Checklist Folha).
import { temLcdpr } from '../../lcdpr/empresas';
import type { Departamento } from '../../usuarios/tipos';
import type { Rotina } from '../tipos';
import { ROTINA_CONTABIL } from './contabil';
import { ROTINA_DP } from './dp';
import { ROTINA_FISCAL } from './fiscal';
import { ROTINA_LCDPR } from './lcdpr';

export function rotinaDo(departamento: Departamento | string | null | undefined): Rotina | null {
  return departamento === 'contabil' ? ROTINA_CONTABIL : departamento === 'fiscal' ? ROTINA_FISCAL : departamento === 'dp' ? ROTINA_DP : null;
}

/**
 * A rotina de uma empresa no departamento (16/10/2026: a 62 "só precisa do lcdpr"): a do departamento; no Contábil, a
 * empresa com o LCDPR (EMPRESAS_COM_LCDPR) tem só a etapa LCDPR. O Fiscal e o DP dela continuam os de sempre.
 */
export function rotinaDaEmpresa(departamento: Departamento | string | null | undefined, codigo: number | null | undefined): Rotina | null {
  return departamento === 'contabil' && temLcdpr(codigo) ? ROTINA_LCDPR : rotinaDo(departamento);
}
