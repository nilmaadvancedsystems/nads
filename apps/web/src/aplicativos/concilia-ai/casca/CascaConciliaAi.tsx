// View da casca da empresa aberta (usa a Casca do design e o ViewModel useCascaConciliaAi).
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useCascaConciliaAi } from './useCascaConciliaAi';

export function CascaConciliaAi({ children }: { children: ReactNode }) {
  const vm = useCascaConciliaAi();
  return (
    <Casca
      sistema="Concilia aí"
      empresa={vm.empresa}
      versao={vm.versao}
      secoes={vm.secoes}
      paginas={vm.paginas}
      titulo={vm.titulo}
      acoes={<LugarDasAcoes />}
      onSecao={vm.onSecao}
      onPagina={vm.onPagina}
      onInicio={vm.sair}
      onEmpresa={vm.voltarInicioDaEmpresa}
      navNaEtapa
    >
      {children}
    </Casca>
  );
}
