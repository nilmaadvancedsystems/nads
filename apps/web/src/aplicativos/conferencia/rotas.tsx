// Rotas da Conferência: /<código da empresa>/<seção>/<página> (ex.: /292/movimento/relatorio).
import type { RouteObject } from 'react-router';
import { AppConferencia } from './AppConferencia';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { Entrada } from './telas/entrada/Entrada';

export const rotasConferencia: RouteObject[] = [
  {
    path: '/',
    element: <AppConferencia />,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
];
