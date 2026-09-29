// Rotas do Extratudo: /extratudo (escolher a empresa) e /extratudo/<empresa>/<ferramenta>/…
// Os links antigos de cada ferramenta (/extrator, /cheque-especial, /creditor) levam para cá.
import { Navigate, type RouteObject } from 'react-router';
import { AppExtratudo } from './AppExtratudo';
import { BASE } from './casca/caminho';
import { EmpresaAberta as ExtratorAberto } from './ferramentas/extrator/casca/EmpresaAberta';
import { rotasDoChequeEspecial } from './ferramentas/cheque-especial/rotas';
import { rotasDoCreditor } from './ferramentas/creditor/rotas';
import { rotasDoExtrator } from './ferramentas/extrator/rotas';
import { Entrada } from './telas/entrada/Entrada';

export const rotasExtratudo: RouteObject[] = [
  {
    path: BASE,
    element: <AppExtratudo />,
    children: [
      { index: true, element: <Entrada /> },
      ...rotasDoExtrator,
      ...rotasDoChequeEspecial,
      ...rotasDoCreditor,
      // só a empresa: abre o Extrator
      { path: ':empresa', element: <ExtratorAberto /> },
    ],
  },
  ...['/extrator/*', '/cheque-especial/*', '/creditor/*'].map(path => ({ path, element: <Navigate to={BASE} replace /> })),
];
