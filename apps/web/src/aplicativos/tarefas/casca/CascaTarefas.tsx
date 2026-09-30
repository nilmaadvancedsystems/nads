// View da casca da Tarefas (a Casca comum do nads).
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import type { IdAplicacao } from './navegacao';
import { useCascaTarefas } from './useCascaTarefas';

export function CascaTarefas({ app, pagina, rotaEmpresa, children }: { app: IdAplicacao; pagina: string; rotaEmpresa?: string; children: ReactNode }) {
  const vm = useCascaTarefas(app, pagina, rotaEmpresa);
  return (
    <Casca sistema="Tarefas" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={vm.titulo}
      acoes={<LugarDasAcoes />} onSecao={vm.onSecao} onPagina={() => undefined} onInicio={vm.inicio} onAplicativos={vm.inicio}
      onEmpresa={vm.trocarPessoa} aplicativos={vm.aplicacoes} onAplicativo={vm.onAplicacao}>
      {children}
    </Casca>
  );
}
