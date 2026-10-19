// Rotas do Mandei (o formulário que o cliente abre pelo link, Vitor, 07/10/2026): /mandei/<código>. Sem login e sem
// nada do sistema do escritório: só o formulário do ticket daquele link.
import type { RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../comum/pedaco';

// um pedaço à parte (revisão da UI, 18/10/2026): só baixa quando o cliente abre o link
const Formulario = pedaco(() => import('./telas/Formulario'), 'Formulario');

export const rotasMandei: RouteObject[] = [
  { path: '/mandei/:codigo', element: <NaEspera inteira><Formulario /></NaEspera> },
  { path: '/mandei', element: <NaEspera inteira><Formulario /></NaEspera> },
];
