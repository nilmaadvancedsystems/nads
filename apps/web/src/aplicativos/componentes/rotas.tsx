// Rotas do catálogo de componentes: /componentes/<tipo>?tela=<tela>.
import { Navigate, type RouteObject } from 'react-router';
import { Catalogo } from './telas/Catalogo';

export const rotasComponentes: RouteObject[] = [
  { path: '/componentes', element: <Navigate to="/componentes/botoes" replace /> },
  { path: '/componentes/:tipo', element: <Catalogo /> },
];
