// View: o Creditor dentro da casca do Extratudo. Desde a primeira etapa (Vitor, 05/10/2026): o título e, embaixo, a
// linha das etapas no Segmentado (AB-02), com o Cancelar e o Próximo à direita (o Próximo travado com pendência).
import { Segmentado } from '@nads/ui';
import type { ReactNode } from 'react';
import { CascaExtratudo } from '../../../casca/CascaExtratudo';
import { useCascaCreditor } from './useCascaCreditor';

export function CascaCreditor({ children }: { children: ReactNode }) {
  const { temDados, cancelar, temProxima, podeSeguir, proximo, ...vm } = useCascaCreditor();
  const atual = vm.paginas.find(p => p.ativa);
  return (
    <CascaExtratudo {...vm}
      acima={atual && (
        <div className="tarefas-barra-topo">
          <Segmentado valor={atual.id} onMudar={vm.onPagina}
            opcoes={vm.paginas.map(p => ({ valor: p.id, rotulo: p.rotulo, travada: p.travada ? 'Resolva as etapas anteriores primeiro' : false }))} />
          <span className="tarefas-barra-espaco" />
          {temDados && <button className="btn btn-outline" type="button" onClick={() => { void cancelar(); }}>Cancelar</button>}
          {temProxima && <button className="btn btn-primary" type="button" disabled={!podeSeguir} onClick={proximo}
            title={podeSeguir ? undefined : 'Resolva as pendências desta etapa primeiro'}>Próximo</button>}
        </div>
      )}>
      {children}
    </CascaExtratudo>
  );
}
