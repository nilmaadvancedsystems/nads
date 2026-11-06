// Rotas do Cheque especial dentro do Extratudo: /extratudo/<empresa>/cheque-especial/<seção>/<página>.
import type { RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../../../comum/pedaco';

// um pedaço à parte (revisão da UI, 18/10/2026): só baixa quando a ferramenta abre
const EmpresaAberta = pedaco(() => import('./casca/EmpresaAberta'), 'EmpresaAberta');

export const rotasDoChequeEspecial: RouteObject[] = [
  { path: ':empresa/cheque-especial/:secao/:pagina', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
  { path: ':empresa/cheque-especial', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
];
