// A rotina de cada departamento: Contábil, o Fiscal (05/10/2026) e o DP (06/10/2026, o Checklist Folha).
import type { Departamento } from '../../usuarios/tipos';
import type { Rotina } from '../tipos';
import { ROTINA_CONTABIL } from './contabil';
import { ROTINA_DP } from './dp';
import { ROTINA_FISCAL } from './fiscal';

export function rotinaDo(departamento: Departamento | string | null | undefined): Rotina | null {
  return departamento === 'contabil' ? ROTINA_CONTABIL : departamento === 'fiscal' ? ROTINA_FISCAL : departamento === 'dp' ? ROTINA_DP : null;
}
