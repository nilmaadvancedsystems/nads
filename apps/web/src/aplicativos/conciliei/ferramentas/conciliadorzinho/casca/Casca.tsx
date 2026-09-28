// View da casca do Conciliadorzinho: a casca do Conciliei com as etapas nas abas do cabeçalho
// (travadas até serem alcançadas). "Cancelar" fica nas ações do topo, antes das da própria etapa.
import type { ReactNode } from 'react';
import { CascaConciliei } from '../../../casca/CascaConciliei';
import { useCascaConciliador } from './useCascaConciliador';

export function CascaConciliador({ children }: { children: ReactNode }) {
  const vm = useCascaConciliador();
  return (
    <CascaConciliei ferramenta="conciliadorzinho" empresa={vm.empresa} rota={vm.rota} paginas={vm.paginas} titulo={vm.titulo}
      onPagina={vm.onPagina} onEmpresa={vm.voltarAoInicio}
      acoes={vm.temArquivos && <button className="btn btn-outline" type="button" onClick={() => { void vm.cancelar(); }}>Cancelar</button>}>
      <p className="page-eyebrow" style={{ marginBottom: 12 }}>{vm.etapaDeTotal}</p>
      {children}
    </CascaConciliei>
  );
}
