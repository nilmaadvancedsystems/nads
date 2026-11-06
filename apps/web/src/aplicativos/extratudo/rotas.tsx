// Rotas do Extratudo: /extratudo (escolher a empresa) e /extratudo/<empresa>/<ferramenta>/…
// Os links antigos de cada ferramenta (/extrator, /cheque-especial, /creditor) levam para cá.
import { Navigate, type RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../comum/pedaco';
import { AppExtratudo } from './AppExtratudo';
import { BASE } from './casca/caminho';
import { rotasDoChequeEspecial } from './ferramentas/cheque-especial/rotas';
import { rotasDoCreditor } from './ferramentas/creditor/rotas';
import { rotasDosCartoes } from './ferramentas/cartoes/rotas';
import { rotasDoExtrator } from './ferramentas/extrator/rotas';

// as telas são pedaços à parte (revisão da UI, 18/10/2026): só baixam quando abrem
const ExtratorAberto = pedaco(() => import('./ferramentas/extrator/casca/EmpresaAberta'), 'EmpresaAberta');
const PreviaPedirExtratos = pedaco(() => import('./ferramentas/extrator/telas/tarefa/PreviaPedirExtratos'), 'PreviaPedirExtratos');
const Entrada = pedaco(() => import('./telas/entrada/Entrada'), 'Entrada');

export const rotasExtratudo: RouteObject[] = [
  {
    path: BASE,
    element: <AppExtratudo />,
    children: [
      { index: true, element: <NaEspera inteira><Entrada /></NaEspera> },
      ...rotasDoExtrator,
      ...rotasDoChequeEspecial,
      ...rotasDoCreditor,
      ...rotasDosCartoes,
      // prévia só da janela do Pedir extratos (para trabalhar a tela separada)
      { path: 'previa/pedir-extratos', element: <NaEspera inteira><PreviaPedirExtratos /></NaEspera> },
      // só a empresa: abre o Extrator
      { path: ':empresa', element: <NaEspera inteira><ExtratorAberto /></NaEspera> },
    ],
  },
  ...['/extrator/*', '/cheque-especial/*', '/creditor/*'].map(path => ({ path, element: <Navigate to={BASE} replace /> })),
];
