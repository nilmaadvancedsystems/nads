// View da casca da empresa aberta no Extrator (a Casca comum do nads).
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useCascaExtrator } from './useCascaExtrator';

export function CascaExtrator({ children }: { children: ReactNode }) {
  const vm = useCascaExtrator();
  return (
    <Casca sistema="Extrator" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={vm.titulo}
      acoes={<LugarDasAcoes />} onSecao={vm.onSecao} onPagina={vm.onPagina} onInicio={vm.sair} onAplicativos={vm.aplicativos}
      onEmpresa={vm.voltarAoInicio} aplicativos={vm.menuAplicativos} onAplicativo={vm.abrirAplicativo}>
      {children}
    </Casca>
  );
}
