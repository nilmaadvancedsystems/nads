// View da casca do Creditor: a casca do Concilia aí com as etapas nas abas do cabeçalho.
import type { ReactNode } from 'react';
import { CascaConciliaAi } from '../../../casca/CascaConciliaAi';
import { useCascaCreditor } from './useCascaCreditor';

export function CascaCreditor({ children }: { children: ReactNode }) {
  const vm = useCascaCreditor();
  return (
    <CascaConciliaAi ferramenta={{
      paginas: vm.paginas, titulo: vm.titulo, onPagina: vm.onPagina, onEmpresa: vm.voltarAoInicio,
      acoes: vm.temDados && <button className="btn btn-outline" type="button" onClick={() => { void vm.cancelar(); }}>Cancelar</button>,
    }}>
      <p className="page-eyebrow" style={{ marginBottom: 12 }}>{vm.etapaDeTotal}</p>
      {children}
    </CascaConciliaAi>
  );
}
