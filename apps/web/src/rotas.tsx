// Rotas do nads: hoje um aplicativo só, o Concilia aí (aplicativos/concilia-ai/rotas.tsx), na raiz.
// São caminhos de verdade na URL; a hospedagem (firebase.json) reescreve qualquer caminho para
// index.html, então acessar ou recarregar um link direto funciona. Caminho que não é de nada vai
// para a escolha de empresa.
import { createBrowserRouter, Navigate } from 'react-router';
import { rotasConciliaAi } from './aplicativos/concilia-ai/rotas';

export const roteador = createBrowserRouter([
  ...rotasConciliaAi,
  { path: '*', element: <Navigate to="/" replace /> },
]);
