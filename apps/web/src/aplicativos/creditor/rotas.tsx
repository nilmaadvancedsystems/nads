// Rotas do Creditor: /creditor (escolher a empresa) e /creditor/<código da empresa>/<etapa>.
import type { RouteObject } from 'react-router';
import { BASE } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { Entrada } from './telas/entrada/Entrada';

export const rotasCreditor: RouteObject[] = [
  {
    path: BASE,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:etapa', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
];
