// Rotas do Cartões dentro do Extratudo: /extratudo/<empresa>/cartoes/<seção>/<página>.
import type { RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../../../comum/pedaco';

// um pedaço à parte (revisão da UI, 18/10/2026): só baixa quando a ferramenta abre
const EmpresaAberta = pedaco(() => import('./casca/EmpresaAberta'), 'EmpresaAberta');

export const rotasDosCartoes: RouteObject[] = [
  { path: ':empresa/cartoes/:secao/:pagina', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
  { path: ':empresa/cartoes', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
];
