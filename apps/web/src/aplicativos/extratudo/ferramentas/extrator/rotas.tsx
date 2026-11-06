// Rotas do Extrator dentro do Extratudo: /extratudo/<empresa>/extrator/<seção>/<página>
// (ex.: /extratudo/292/extrator/conferencia/resultado).
import type { RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../../../comum/pedaco';

// um pedaço à parte (revisão da UI, 18/10/2026): só baixa quando a ferramenta abre
const EmpresaAberta = pedaco(() => import('./casca/EmpresaAberta'), 'EmpresaAberta');

export const rotasDoExtrator: RouteObject[] = [
  { path: ':empresa/extrator/:secao/:pagina', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
  { path: ':empresa/extrator', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
];
