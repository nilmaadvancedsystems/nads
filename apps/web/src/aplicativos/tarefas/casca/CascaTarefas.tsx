// View da casca da Tarefas (a Casca comum do nads).
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import { BarraTarefas } from './BarraTarefas';
import type { IdAplicacao } from './navegacao';
import { useCascaTarefas } from './useCascaTarefas';

export function CascaTarefas({ app, pagina, children }: { app: IdAplicacao; pagina: string; children: ReactNode }) {
  const vm = useCascaTarefas(app, pagina);
  return (
    <Casca sistema="Tarefas" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={vm.titulo}
      acoes={<LugarDasAcoes />} barra={<BarraTarefas />} onSecao={vm.onSecao} onPagina={() => undefined} onInicio={vm.inicio} onAplicativos={vm.inicio}
      onEmpresa={vm.irParaAplicacao} aplicativos={vm.aplicacoes} onAplicativo={vm.onAplicacao}>
      {children}
    </Casca>
  );
}
