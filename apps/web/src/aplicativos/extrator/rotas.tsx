// Rotas do Extrator: /extrator (escolher a empresa) e /extrator/<código da empresa>/<seção>/<página>
// (ex.: /extrator/292/conferencia/resultado).
import type { RouteObject } from 'react-router';
import { AppExtrator } from './AppExtrator';
import { BASE } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { Entrada } from './telas/entrada/Entrada';

export const rotasExtrator: RouteObject[] = [
  {
    path: BASE,
    element: <AppExtrator />,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
];
