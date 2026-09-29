// Rotas do Concilia aí (a Conferência): / (escolher a empresa) e /<código da empresa>/<seção>/<página>
// (ex.: /292/movimento/relatorio). Os links de quando ela morava em /conferencia/… continuam
// funcionando: /conferencia/292/movimento/relatorio → /292/movimento/relatorio.
import { Navigate, useLocation, useParams, type RouteObject } from 'react-router';
import { AppConciliaAi } from './AppConciliaAi';
import { caminho } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { Entrada } from './telas/entrada/Entrada';

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
      { index: true, element: <Entrada /> },
      { path: ':empresa/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa/:secao', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
  { path: '/conferencia/*', element: <LinkConferencia /> },
];
