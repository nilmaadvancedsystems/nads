// View da casca da empresa aberta (usa a Casca do design e o ViewModel useCascaConferencia).
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useCascaConferencia } from './useCascaConferencia';

export function CascaConferencia({ children }: { children: ReactNode }) {
  const vm = useCascaConferencia();
  return (
    <Casca
      sistema="Conferência"
      empresa={vm.empresa}
      versao={vm.versao}
      secoes={vm.secoes}
      paginas={vm.paginas}
      titulo={vm.titulo}
      acoes={<LugarDasAcoes />}
      onSecao={vm.onSecao}
      onPagina={vm.onPagina}
      onInicio={vm.sair}
      onAplicativos={vm.aplicativos}
      onEmpresa={vm.voltarInicioDaEmpresa}
      onSair={vm.sair}
    >
      {children}
    </Casca>
  );
}
