// Rotas do Conciliadorzinho: /conciliadorzinho (escolher a empresa) e
// /conciliadorzinho/<código da empresa>/conciliacao/<etapa>.
import type { RouteObject } from 'react-router';
import { BASE } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { Entrada } from './telas/entrada/Entrada';

export const rotasConciliadorzinho: RouteObject[] = [
  {
    path: BASE,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
];
