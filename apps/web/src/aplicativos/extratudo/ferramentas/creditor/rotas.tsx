// Rotas do Creditor dentro do Extratudo: /extratudo/<empresa>/creditor/<etapa>.
import type { RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../../../comum/pedaco';

// um pedaço à parte (revisão da UI, 18/10/2026): só baixa quando a ferramenta abre
const EmpresaAberta = pedaco(() => import('./casca/EmpresaAberta'), 'EmpresaAberta');

export const rotasDoCreditor: RouteObject[] = [
  { path: ':empresa/creditor/:etapa', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
  { path: ':empresa/creditor', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
];
