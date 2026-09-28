// View da casca do Cheque especial: a casca do Conciliei com as páginas dele nas abas do cabeçalho.
import type { empresas } from '@nads/core';
import type { ReactNode } from 'react';
import { CascaConciliei } from '../../../casca/CascaConciliei';
import { useCascaCheque } from './useCascaCheque';

export function CascaCheque({ empresa, rota, pagina, children }: { empresa: empresas.EmpresaDoEscritorio; rota: string; pagina: string; children: ReactNode }) {
  const vm = useCascaCheque(rota, pagina);
  return (
    <CascaConciliei ferramenta="cheque-especial" empresa={empresa} rota={rota} paginas={vm.paginas} titulo={vm.titulo} onPagina={vm.onPagina}>
      {children}
    </CascaConciliei>
  );
}
