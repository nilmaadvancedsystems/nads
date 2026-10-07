// Rotas do Mandei (o formulário que o cliente abre pelo link, Vitor, 07/10/2026): /mandei/<código>. Sem login e sem
// nada do sistema do escritório: só o formulário do ticket daquele link.
import type { RouteObject } from 'react-router';
import { Formulario } from './telas/Formulario';

export const rotasMandei: RouteObject[] = [
  { path: '/mandei/:codigo', element: <Formulario /> },
  { path: '/mandei', element: <Formulario /> },
];
