// As rotas do site do admin (admin-nilma, admin.nilmacontabilidade.com; 21/10/2026). No build desse site
// (VITE_APLICATIVO=admin) o main.tsx recebe ESTE arquivo no lugar do rotas.tsx, que importa todos os aplicativos (o plugin
// nads-rotas-proprias do vite.config.ts, o mesmo da Área do Cliente): assim o pacote leva só o site do admin e as telas
// da Tarefas que ele reaproveita (o painel do robô, o uso do sistema, os feedbacks e o sistema e agentes).
import { createBrowserRouter, Navigate } from 'react-router';
import { rotasAdmin } from './aplicativos/admin/rotas';
import { ErroDaTela } from './comum/ErroDaTela';

document.title = 'Admin — Nilma';

export const roteador = createBrowserRouter([
  ...rotasAdmin.map(r => ({ ...r, errorElement: <ErroDaTela /> })),
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '*', element: <Navigate to="/admin" replace /> },
]);
