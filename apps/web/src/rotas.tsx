// Rotas do nads: três aplicativos separados, cada um com as suas rotas (aplicativos/<app>/rotas.tsx).
//   Concilia aí (a Conferência) ... /  e  /<código>/<seção>/<página>
//   Conciliadorzinho ............. /conciliadorzinho/…
//   Extratudo .................... /extratudo/<código>/<ferramenta>/…  (Extrator, Cheque especial, Creditor)
// São caminhos de verdade na URL; a hospedagem (firebase.json) reescreve qualquer caminho para index.html.
//
// VITE_APLICATIVO=<id> gera um site com UM aplicativo só (o link de cada um): as rotas dos outros
// nem entram, e a raiz leva direto a ele. Sem a variável, entram os três.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { rotasConciliaAi } from './aplicativos/concilia-ai/rotas';
import { rotasConciliadorzinho } from './aplicativos/conciliadorzinho/rotas';
import { rotasExtratudo } from './aplicativos/extratudo/rotas';

const APLICATIVOS: Record<string, { nome: string; rotas: RouteObject[]; raiz: string }> = {
  'concilia-ai': { nome: 'Concilia aí', rotas: rotasConciliaAi, raiz: '/' },
  conciliadorzinho: { nome: 'Conciliadorzinho', rotas: rotasConciliadorzinho, raiz: '/conciliadorzinho' },
  extratudo: { nome: 'Extratudo', rotas: rotasExtratudo, raiz: '/extratudo' },
};

const so = APLICATIVOS[import.meta.env.VITE_APLICATIVO || ''];
if (so) document.title = so.nome + ' — Nilma';

export const roteador = createBrowserRouter(so
  ? [...so.rotas, ...(so.raiz !== '/' ? [{ path: '/', element: <Navigate to={so.raiz} replace /> }] : []), { path: '*', element: <Navigate to={so.raiz} replace /> }]
  : [
    ...rotasConciliadorzinho,
    ...rotasExtratudo,
    ...rotasConciliaAi,
    { path: '*', element: <Navigate to="/" replace /> },
  ]);
