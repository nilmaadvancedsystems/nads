// Rotas do Cheque especial: /cheque-especial (escolher a empresa) e
// /cheque-especial/<código da empresa>/<seção>/<página>.
import type { RouteObject } from 'react-router';
import { BASE } from './casca/caminho';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { Entrada } from './telas/entrada/Entrada';

export const rotasChequeEspecial: RouteObject[] = [
  {
    path: BASE,
    children: [
      { index: true, element: <Entrada /> },
      { path: ':empresa/:secao/:pagina', element: <EmpresaAberta /> },
      { path: ':empresa', element: <EmpresaAberta /> },
    ],
  },
];
