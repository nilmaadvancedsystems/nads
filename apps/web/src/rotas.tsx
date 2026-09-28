// Rotas do nads: junta as rotas de cada aplicativo (aplicativos/<app>/rotas.tsx).
// São caminhos de verdade na URL; a hospedagem (firebase.json) reescreve qualquer caminho
// para index.html, então acessar ou recarregar um link direto continua funcionando.
import { createBrowserRouter, Navigate } from 'react-router';
import { rotasConferencia } from './aplicativos/conferencia/rotas';

export const roteador = createBrowserRouter([
  ...rotasConferencia,
  { path: '*', element: <Navigate to="/" replace /> },
]);
