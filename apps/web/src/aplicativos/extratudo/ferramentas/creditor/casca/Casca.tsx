// View: o Creditor dentro da casca do Extratudo. "Cancelar" fica nas ações do topo, antes das ações
// da própria etapa; acima da tela, as etapas no Segmentado (AB-02; Vitor, 05/10/2026: no lugar do "Etapa n de 5").
import { Segmentado } from '@nads/ui';
import type { ReactNode } from 'react';
import { CascaExtratudo } from '../../../casca/CascaExtratudo';
import { useCascaCreditor } from './useCascaCreditor';

export function CascaCreditor({ children }: { children: ReactNode }) {
  const { temDados, cancelar, primeira, ...vm } = useCascaCreditor();
  const atual = vm.paginas.find(p => p.ativa);
  return (
    <CascaExtratudo {...vm}
      acoes={temDados && <button className="btn btn-outline" type="button" onClick={() => { void cancelar(); }}>Cancelar</button>}
      acima={!primeira && atual && (
        <div style={{ marginBottom: 12 }}>
          <Segmentado valor={atual.id} onMudar={vm.onPagina}
            opcoes={vm.paginas.map(p => ({ valor: p.id, rotulo: p.rotulo, travada: p.travada ? 'Resolva as etapas anteriores primeiro' : false }))} />
        </div>
      )}>
      {children}
    </CascaExtratudo>
  );
}
