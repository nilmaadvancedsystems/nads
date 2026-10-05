// View: o Creditor dentro da casca do Extratudo. "Cancelar" fica na linha das etapas, à direita (Vitor, 05/10/2026:
// "alinhado com as etapas"; na primeira, que não tem as etapas, nas ações do topo); acima da tela, as etapas no Segmentado (AB-02; Vitor, 05/10/2026: no lugar do "Etapa n de 5").
import { Segmentado } from '@nads/ui';
import type { ReactNode } from 'react';
import { CascaExtratudo } from '../../../casca/CascaExtratudo';
import { useCascaCreditor } from './useCascaCreditor';

export function CascaCreditor({ children }: { children: ReactNode }) {
  const { temDados, cancelar, primeira, ...vm } = useCascaCreditor();
  const atual = vm.paginas.find(p => p.ativa);
  const botaoCancelar = temDados && <button className="btn btn-outline" type="button" onClick={() => { void cancelar(); }}>Cancelar</button>;
  return (
    <CascaExtratudo {...vm}
      acoes={primeira && botaoCancelar}
      acima={!primeira && atual && (
        <div className="tarefas-barra-topo">
          <Segmentado valor={atual.id} onMudar={vm.onPagina}
            opcoes={vm.paginas.map(p => ({ valor: p.id, rotulo: p.rotulo, travada: p.travada ? 'Resolva as etapas anteriores primeiro' : false }))} />
          <span className="tarefas-barra-espaco" />
          {botaoCancelar}
        </div>
      )}>
      {children}
    </CascaExtratudo>
  );
}
