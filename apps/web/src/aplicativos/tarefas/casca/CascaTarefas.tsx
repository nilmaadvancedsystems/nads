// View da casca da Tarefas (a Casca comum do nads). telaInteira: sem a barra lateral e sem o título (o Drive).
import { Casca } from '@nads/ui';
import type { ReactNode } from 'react';
import { LugarDasAcoes } from '../../../comum/topo';
import type { IdAplicacao } from './navegacao';
import { useCascaTarefas } from './useCascaTarefas';

export function CascaTarefas({ app, pagina, telaInteira, children }: { app: IdAplicacao; pagina: string; telaInteira?: boolean; children: ReactNode }) {
  const vm = useCascaTarefas(app, pagina);
  return (
    <Casca sistema="Tarefas" empresa={vm.empresa} versao={vm.versao} secoes={vm.secoes} paginas={vm.paginas} titulo={telaInteira ? '' : vm.titulo}
      lateral={telaInteira ? 'nenhuma' : undefined} larga={telaInteira}
      acoes={telaInteira ? undefined : <LugarDasAcoes />} onSecao={vm.onSecao} onPagina={() => undefined} onInicio={vm.inicio} onAplicativos={vm.inicio}
      onEmpresa={vm.trocarPessoa} aplicativos={vm.aplicacoes} onAplicativo={vm.onAplicacao}>
      {children}
    </Casca>
  );
}
