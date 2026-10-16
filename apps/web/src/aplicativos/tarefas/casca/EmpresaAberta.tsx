// Rota da página de uma empresa: /tarefas/minhas-empresas/empresa/:empresa (dentro de Minhas empresas). Nas empresas com o
// LCDPR (EMPRESAS_COM_LCDPR, 16/10/2026), a barra lateral ganha a Rotina e as telas dele, em …/empresa/:empresa/lcdpr/:pagina.
import { useParams } from 'react-router';
import { TopoProvider } from '../../../comum/topo';
import { EmpresaTarefas } from '../telas/empresa/EmpresaTarefas';
import { PaginaDoLcdpr } from '../telas/empresa/lcdpr/PaginaDoLcdpr';
import { useLateralDoLcdpr } from '../telas/empresa/lcdpr/useLateralDoLcdpr';
import { CascaTarefas } from './CascaTarefas';

export function EmpresaAberta() {
  const { empresa = '', pagina } = useParams();
  const lateral = useLateralDoLcdpr(empresa, pagina ?? null);
  return (
    <TopoProvider>
      <CascaTarefas app="minhas-empresas" pagina="empresas" larga daEmpresa={lateral}>
        {pagina != null ? <PaginaDoLcdpr rota={empresa} pagina={pagina} /> : <EmpresaTarefas rota={empresa} />}
      </CascaTarefas>
    </TopoProvider>
  );
}
