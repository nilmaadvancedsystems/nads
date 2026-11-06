// Rotas do Concilia aí (a Conferência): / (escolher a empresa) e /<código da empresa>/<seção>/<página>
// (ex.: /292/movimento/relatorio). Os links de quando ela morava em /conferencia/… continuam
// funcionando: /conferencia/292/movimento/relatorio → /292/movimento/relatorio.
import { Navigate, useLocation, useParams, type RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../comum/pedaco';
import { AppConciliaAi } from './AppConciliaAi';
import { caminho } from './casca/caminho';

// as telas são pedaços à parte (revisão da UI, 18/10/2026): só baixam quando abrem
const EmpresaAberta = pedaco(() => import('./casca/EmpresaAberta'), 'EmpresaAberta');
const Entrada = pedaco(() => import('./telas/entrada/Entrada'), 'Entrada');

/** /conferencia/… → o mesmo caminho sem o /conferencia. */
function LinkConferencia() {
  const { '*': resto = '' } = useParams();
  const { search } = useLocation();
  return <Navigate to={caminho(resto) + search} replace />;
}

export const rotasConciliaAi: RouteObject[] = [
  {
    path: '/',
    element: <AppConciliaAi />,
    children: [
      { index: true, element: <NaEspera inteira><Entrada /></NaEspera> },
      { path: ':empresa/:secao/:pagina', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
      { path: ':empresa/:secao', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
      { path: ':empresa', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
    ],
  },
  { path: '/conferencia/*', element: <LinkConferencia /> },
];

/**
 * A Conferência dentro da Tarefas (a etapa Conferência fiscal, no mesmo endereço): só a empresa aberta
 * (/<código>/<seção>/<página>), sem a tela de escolher a empresa — a raiz do site continua sendo a Tarefas.
 */
export const rotasConciliaAiNaTarefa: RouteObject[] = [
  {
    element: <AppConciliaAi />,
    children: [
      { path: ':empresa/:secao/:pagina', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
      { path: ':empresa/:secao', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
    ],
  },
];
