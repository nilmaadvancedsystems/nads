// Rota da página de uma empresa: /tarefas/minhas-empresas/empresa/:empresa (dentro de Minhas empresas). O LCDPR da 62
// (16/10/2026) saiu da barra lateral e virou a rotina do Contábil dela ("ele só precisa do lcdpr"): um caminho só, a etapa
// LCDPR do executor. O endereço antigo (…/empresa/:empresa/lcdpr/:pagina) volta para a página da empresa.
import { Navigate, useLocation, useParams } from 'react-router';
import { TopoProvider } from '../../../comum/topo';
import { EmpresaTarefas } from '../telas/empresa/EmpresaTarefas';
import { CascaTarefas } from './CascaTarefas';
import { BASE } from './navegacao';

export function EmpresaAberta() {
  const { empresa = '', pagina } = useParams();
  const { search } = useLocation();
  if (pagina != null) return <Navigate to={BASE + '/minhas-empresas/empresa/' + empresa + search} replace />;
  return (
    <TopoProvider>
      <CascaTarefas app="minhas-empresas" pagina="empresas" larga>
        <EmpresaTarefas rota={empresa} />
      </CascaTarefas>
    </TopoProvider>
  );
}
