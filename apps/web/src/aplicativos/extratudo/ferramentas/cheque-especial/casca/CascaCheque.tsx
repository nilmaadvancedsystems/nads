// View: o Cheque especial dentro da casca do Extratudo.
import type { empresas } from '@nads/core';
import type { ReactNode } from 'react';
import { CascaExtratudo } from '../../../casca/CascaExtratudo';
import { useCascaCheque } from './useCascaCheque';

export function CascaCheque({ empresa, rota, pagina, children }: { empresa: empresas.EmpresaDoEscritorio; rota: string; pagina: string; children: ReactNode }) {
  const vm = useCascaCheque(empresa, rota, pagina);
  return <CascaExtratudo {...vm}>{children}</CascaExtratudo>;
}
