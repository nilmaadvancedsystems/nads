// Rota da página de uma empresa: /tarefas/minhas-empresas/empresa/:empresa (dentro de Minhas empresas).
import { useParams } from 'react-router';
import { TopoProvider } from '../../../comum/topo';
import { EmpresaTarefas } from '../telas/empresa/EmpresaTarefas';
import { CascaTarefas } from './CascaTarefas';

export function EmpresaAberta() {
  const { empresa = '' } = useParams();
  return (
    <TopoProvider>
      <CascaTarefas app="minhas-empresas" pagina="empresas" larga>
        <EmpresaTarefas rota={empresa} />
      </CascaTarefas>
    </TopoProvider>
  );
}
