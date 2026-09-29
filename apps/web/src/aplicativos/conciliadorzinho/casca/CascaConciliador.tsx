// View da casca do Conciliadorzinho (a Casca comum do nads). "Cancelar" fica nas ações do topo,
// antes das ações da própria etapa.
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { useCascaConciliador } from './useCascaConciliador';

export function CascaConciliador({ children }: { children: ReactNode }) {
  const vm = useCascaConciliador();
  return (
    <Casca sistema="Conciliadorzinho" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={vm.titulo}
      acoes={<>
        {vm.temArquivos && <button className="btn btn-outline" type="button" onClick={() => { void vm.cancelar(); }}>Cancelar</button>}
        <LugarDasAcoes />
      </>}
      onSecao={vm.onSecao} onPagina={() => undefined} onInicio={vm.sair}
      onEmpresa={vm.voltarAoInicio}>
      <p className="page-eyebrow" style={{ marginBottom: 12 }}>{vm.etapaDeTotal}</p>
      {children}
    </Casca>
  );
}
