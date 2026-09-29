// View: o Creditor dentro da casca do Extratudo. "Cancelar" fica nas ações do topo, antes das ações
// da própria etapa, e "Etapa n de 5" (ou de 4) acima da tela.
import type { ReactNode } from 'react';
import { CascaExtratudo } from '../../../casca/CascaExtratudo';
import { useCascaCreditor } from './useCascaCreditor';

export function CascaCreditor({ children }: { children: ReactNode }) {
  const { etapaDeTotal, temDados, cancelar, ...vm } = useCascaCreditor();
  return (
    <CascaExtratudo {...vm}
      acoes={temDados && <button className="btn btn-outline" type="button" onClick={() => { void cancelar(); }}>Cancelar</button>}
      acima={<p className="page-eyebrow" style={{ marginBottom: 12 }}>{etapaDeTotal}</p>}>
      {children}
    </CascaExtratudo>
  );
}
