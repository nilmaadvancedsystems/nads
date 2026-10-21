// Rotas do site do admin: /admin/<página> (Visão geral, Robô, Uso do sistema, Saúde do banco, Cota e custos, Feedbacks,
// Sistema e agentes). As telas do robô, do uso, dos feedbacks e do sistema são as MESMAS da Tarefas (os mesmos view-models);
// a Visão geral, a Saúde do banco e a Cota são daqui. Cada tela é um pedaço à parte: só baixa quando a pessoa abre.
import { Navigate, useParams, type RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../comum/pedaco';
import { TopoProvider } from '../../comum/topo';
import { AppAdmin } from './AppAdmin';
import { CascaAdmin } from './casca/CascaAdmin';
import { BASE, caminhoDoAdmin, paginaDoAdmin, type IdPaginaAdmin } from './casca/navegacao';

const VisaoGeral = pedaco(() => import('./telas/visao-geral/VisaoGeral'), 'VisaoGeral');
const SaudeDoBanco = pedaco(() => import('./telas/banco/SaudeDoBanco'), 'SaudeDoBanco');
const CotaECustos = pedaco(() => import('./telas/cota/CotaECustos'), 'CotaECustos');
const FeedbacksDoAdmin = pedaco(() => import('./telas/feedbacks/FeedbacksDoAdmin'), 'FeedbacksDoAdmin');
const PainelDoRobo = pedaco(() => import('../tarefas/telas/cadastro/painel-robo/PainelDoRobo'), 'PainelDoRobo');
const UsoDoSistema = pedaco(() => import('../tarefas/telas/uso/UsoDoSistema'), 'UsoDoSistema');
const RobosEAgentes = pedaco(() => import('../tarefas/telas/cadastro/configuracoes/ConfiguracoesDoNads'), 'RobosEAgentes');

function Tela({ pagina }: { pagina: IdPaginaAdmin }) {
  switch (pagina) {
    case 'visao-geral': return <VisaoGeral />;
    case 'robo': return <PainelDoRobo />;
    case 'uso': return <UsoDoSistema />;
    case 'banco': return <SaudeDoBanco />;
    case 'cota': return <CotaECustos />;
    case 'feedbacks': return <FeedbacksDoAdmin />;
    case 'sistema': return <RobosEAgentes />;
  }
}

function PaginaDoAdmin() {
  const { pagina = '' } = useParams();
  const p = paginaDoAdmin(pagina);
  if (!p) return <Navigate to={caminhoDoAdmin('visao-geral')} replace />;
  return (
    <TopoProvider>
      <CascaAdmin pagina={p.id}>
        <NaEspera><Tela pagina={p.id} /></NaEspera>
      </CascaAdmin>
    </TopoProvider>
  );
}

export const rotasAdmin: RouteObject[] = [
  {
    path: BASE,
    element: <AppAdmin />,
    children: [
      { index: true, element: <Navigate to={caminhoDoAdmin('visao-geral')} replace /> },
      { path: ':pagina', element: <PaginaDoAdmin /> },
      { path: '*', element: <Navigate to={caminhoDoAdmin('visao-geral')} replace /> },
    ],
  },
];
