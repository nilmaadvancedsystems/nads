// View da casca do Cheque especial: a casca do Concilia aí com as páginas dele nas abas do cabeçalho.
import type { ReactNode } from 'react';
import { CascaConciliaAi } from '../../../casca/CascaConciliaAi';
import { useCascaCheque } from './useCascaCheque';

export function CascaCheque({ rota, pagina, children }: { rota: string; pagina: string; children: ReactNode }) {
  const vm = useCascaCheque(rota, pagina);
  return <CascaConciliaAi ferramenta={vm}>{children}</CascaConciliaAi>;
}
