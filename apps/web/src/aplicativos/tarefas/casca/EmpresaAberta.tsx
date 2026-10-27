// Rota da empresa aberta: /tarefas/minhas-empresas/empresa/:empresa/:pagina (dentro de Minhas empresas; 27/10/2026). Na
// barra lateral, as páginas dela no setor (Tarefas, Visão geral, Drive e, no Fiscal, as ferramentas); no cabeçalho, o
// cartão com o código e o CNPJ. Sem a página, a Visão geral. O LCDPR da 62 (16/10/2026) virou a rotina do Contábil dela: o
// endereço antigo (…/empresa/:empresa/lcdpr/:pagina) volta para a empresa.
import { Navigate, useLocation, useParams } from 'react-router';
import { NaEspera, pedaco } from '../../../comum/pedaco';
import { TopoProvider } from '../../../comum/topo';
import { EmpresaTarefas } from '../telas/empresa/EmpresaTarefas';
import { CascaTarefas } from './CascaTarefas';
import { BASE } from './navegacao';
import { useEmpresaAberta } from './useEmpresaAberta';

const ExploradorDoDrive = pedaco(() => import('../telas/drive/ExploradorDoDrive'), 'ExploradorDoDrive');
const RateioDeFrete = pedaco(() => import('../telas/fiscal/rateio/RateioDeFrete'), 'RateioDeFrete');
const CalculadoraDoSimples = pedaco(() => import('../telas/fiscal/simples/CalculadoraDoSimples'), 'CalculadoraDoSimples');
const AntecipacaoIcms = pedaco(() => import('../telas/fiscal/antecipacao/AntecipacaoIcms'), 'AntecipacaoIcms');

function PaginaDaEmpresa({ rota, pagina }: { rota: string; pagina: string }) {
  switch (pagina) {
    case 'tarefas': return <EmpresaTarefas rota={rota} parte="tarefas" />;
    case 'drive': return <ExploradorDoDrive naEmpresa />;
    case 'rateio-frete': return <RateioDeFrete />;
    case 'simples': return <CalculadoraDoSimples />;
    case 'antecipacao-es': return <AntecipacaoIcms />;
    default: return <EmpresaTarefas rota={rota} parte="visao" />;
  }
}

export function EmpresaAberta() {
  const { empresa: rota = '', pagina = 'visao', lcdpr } = useParams();
  const { search } = useLocation();
  const vm = useEmpresaAberta(rota, pagina);
  if (lcdpr != null) return <Navigate to={BASE + '/minhas-empresas/empresa/' + rota + search} replace />;
  if (!vm.casca) return <Navigate to={BASE} replace />;
  if (!vm.valida) return <Navigate to={vm.paginaInicial} replace />;
  return (
    <TopoProvider>
      <CascaTarefas app="minhas-empresas" pagina="empresas" larga empresa={vm.casca}>
        <NaEspera><PaginaDaEmpresa rota={rota} pagina={pagina} /></NaEspera>
      </CascaTarefas>
    </TopoProvider>
  );
}
