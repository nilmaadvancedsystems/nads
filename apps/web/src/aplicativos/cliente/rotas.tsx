// Rotas da Área do Cliente (Vitor, 16/10/2026): /cliente/<token>/<aba>. O link secreto de cada empresa, sem senha e sem
// nada do sistema do escritório. Por enquanto só com os dados de exemplo (token "exemplo").
import type { RouteObject } from 'react-router';
import { AreaDoCliente } from './telas/AreaDoCliente';

export const rotasCliente: RouteObject[] = [
  { path: '/cliente/:token/:aba?', element: <AreaDoCliente /> },
  { path: '/cliente', element: <AreaDoCliente /> },
];
