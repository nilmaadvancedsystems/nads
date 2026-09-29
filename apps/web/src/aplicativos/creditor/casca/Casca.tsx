// View da casca do Creditor (a Casca comum do nads): etapas na barra lateral, "Cancelar" nas ações
// do topo, antes das ações da própria etapa.
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useCascaCreditor } from './useCascaCreditor';

export function CascaCreditor({ children }: { children: ReactNode }) {
  const vm = useCascaCreditor();
  return (
    <Casca sistema="Creditor" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={vm.titulo}
      acoes={<>
        {vm.temDados && <button className="btn btn-outline" type="button" onClick={() => { void vm.cancelar(); }}>Cancelar</button>}
        <LugarDasAcoes />
      </>}
      onSecao={vm.onSecao} onPagina={() => undefined} onInicio={vm.sair} onEmpresa={vm.voltarAoInicio}>
      <p className="page-eyebrow" style={{ marginBottom: 12 }}>{vm.etapaDeTotal}</p>
      {children}
    </Casca>
  );
}
