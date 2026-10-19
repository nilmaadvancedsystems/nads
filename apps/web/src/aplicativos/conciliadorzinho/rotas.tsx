// Rotas do Conciliadorzinho: /conciliadorzinho (escolher a empresa) e
// /conciliadorzinho/<código da empresa>/conciliacao/<etapa>.
import type { RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../comum/pedaco';
import { BASE } from './casca/caminho';

// as telas são pedaços à parte (revisão da UI, 18/10/2026): só baixam quando abrem
const EmpresaAberta = pedaco(() => import('./casca/EmpresaAberta'), 'EmpresaAberta');
const Entrada = pedaco(() => import('./telas/entrada/Entrada'), 'Entrada');

export const rotasConciliadorzinho: RouteObject[] = [
  {
    path: BASE,
    children: [
      { index: true, element: <NaEspera inteira><Entrada /></NaEspera> },
      { path: ':empresa/:secao/:pagina', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
      { path: ':empresa', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
    ],
  },
];
