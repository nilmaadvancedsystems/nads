// Rotas da Área do Cliente (Vitor, 16/10/2026): /cliente/<token>/<aba>. O link secreto de cada empresa, sem senha e sem
// nada do sistema do escritório. Por enquanto só com os dados de exemplo (token "exemplo").
import type { RouteObject } from 'react-router';
import { AreaDoCliente } from './telas/AreaDoCliente';
import { CriarSenha } from './telas/CriarSenha';

export const rotasCliente: RouteObject[] = [
  // a página própria de criar a senha (19/11/2026): o link do e-mail do Firebase cai aqui
  { path: '/cliente/senha', element: <CriarSenha /> },
  { path: '/cliente/:token/:aba?', element: <AreaDoCliente /> },
  { path: '/cliente', element: <AreaDoCliente /> },
];
