// As rotas do site da Área do Cliente (cliente-nilma, cliente.nilmacontabilidade.com; 17/10/2026). No build desse site
// (VITE_APLICATIVO=cliente) o main.tsx recebe ESTE arquivo no lugar do rotas.tsx (o plugin nads-so-cliente do
// vite.config.ts): assim o pacote que vai para o cliente não leva nenhuma tela, rota nem dado da equipe — só a Área do
// Cliente. A raiz (sem token) mostra o aviso para usar o link que o escritório enviou.
import { createBrowserRouter, Navigate } from 'react-router';
import { rotasCliente } from './aplicativos/cliente/rotas';
import { AreaDoCliente } from './aplicativos/cliente/telas/AreaDoCliente';

document.title = 'Área do Cliente — Nilma';

export const roteador = createBrowserRouter([
  ...rotasCliente,
  { path: '/', element: <AreaDoCliente /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
