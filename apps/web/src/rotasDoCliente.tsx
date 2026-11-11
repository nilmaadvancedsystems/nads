// As rotas do site da Área do Cliente (cliente-nilma, cliente.nilmacontabilidade.com; 17/10/2026). No build desse site
// (VITE_APLICATIVO=cliente) o main.tsx recebe ESTE arquivo no lugar do rotas.tsx (o plugin nads-rotas-proprias do
// vite.config.ts): assim o pacote que vai para o cliente não leva nenhuma tela, rota nem dado da equipe — só a Área do
// Cliente. A raiz (sem token) mostra o aviso para usar o link que o escritório enviou.
import { createBrowserRouter, Navigate } from 'react-router';
import { rotasCliente } from './aplicativos/cliente/rotas';
import { rotasMandei } from './aplicativos/mandei/rotas';
import { AreaDoCliente } from './aplicativos/cliente/telas/AreaDoCliente';

document.title = 'Área do Cliente — Nilma';

export const roteador = createBrowserRouter([
  ...rotasCliente,
  // o formulário do Mandei (11/11/2026): o Responder da Visão geral abre o ticket aqui mesmo (só o formulário, sem nada da equipe)
  ...rotasMandei,
  { path: '/', element: <AreaDoCliente /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
