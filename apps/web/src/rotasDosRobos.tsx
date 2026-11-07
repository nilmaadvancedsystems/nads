// As rotas do site da Central dos robôs (robos-nilma, robos.nilmacontabilidade.com; 07/11/2026). No build desse site
// (VITE_APLICATIVO=robos) o main.tsx recebe ESTE arquivo no lugar do rotas.tsx (o plugin nads-rotas-proprias do
// vite.config.ts, o mesmo do Admin e da Área do Cliente): o pacote leva só a central e o login.
import { createBrowserRouter, Navigate } from 'react-router';
import { rotasRobos } from './aplicativos/robos/rotas';
import { ErroDaTela } from './comum/ErroDaTela';

document.title = 'Central dos robôs — Nilma';

export const roteador = createBrowserRouter([
  ...rotasRobos.map(r => ({ ...r, errorElement: <ErroDaTela /> })),
  { path: '/', element: <Navigate to="/robos" replace /> },
  { path: '*', element: <Navigate to="/robos" replace /> },
]);
