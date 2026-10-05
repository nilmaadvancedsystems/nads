// A rotina de cada departamento (Contábil e, desde 05/10/2026, o Fiscal). O DP ainda não tem: null.
import type { Departamento } from '../../usuarios/tipos';
import type { Rotina } from '../tipos';
import { ROTINA_CONTABIL } from './contabil';
import { ROTINA_FISCAL } from './fiscal';

export function rotinaDo(departamento: Departamento | string | null | undefined): Rotina | null {
  return departamento === 'contabil' ? ROTINA_CONTABIL : departamento === 'fiscal' ? ROTINA_FISCAL : null;
}
