// View: o Cartões dentro da casca do Extratudo.
import type { empresas } from '@nads/core';
import type { ReactNode } from 'react';
import { CascaExtratudo } from '../../../casca/CascaExtratudo';
import { useCascaCartoes } from './useCascaCartoes';

export function CascaCartoes({ empresa, rota, pagina, children }: { empresa: empresas.EmpresaDoEscritorio; rota: string; pagina: string; children: ReactNode }) {
  const vm = useCascaCartoes(empresa, rota, pagina);
  return <CascaExtratudo {...vm}>{children}</CascaExtratudo>;
}
