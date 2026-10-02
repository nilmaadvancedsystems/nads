// Rotas do nads: quatro aplicativos separados, cada um com as suas rotas (aplicativos/<app>/rotas.tsx).
//   Concilia aí (a Conferência) ... /  e  /<código>/<seção>/<página>
//   Conciliadorzinho ............. /conciliadorzinho/…
//   Extratudo .................... /extratudo/<código>/<ferramenta>/…  (Extrator, Cheque especial, Creditor)
//   Tarefas ...................... /tarefas/<aplicação>/<página>  e  /tarefas/executar/<código>/<competência>
// São caminhos de verdade na URL; a hospedagem (firebase.json) reescreve qualquer caminho para index.html.
//
// VITE_APLICATIVO=<id> gera um site com UM aplicativo só (o link de cada um): as rotas dos outros
// nem entram, e a raiz leva direto a ele. Sem a variável, entram os quatro.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { rotasConciliaAi, rotasConciliaAiNaTarefa } from './aplicativos/concilia-ai/rotas';
import { rotasComponentes } from './aplicativos/componentes/rotas';
import { rotasConciliadorzinho } from './aplicativos/conciliadorzinho/rotas';
import { rotasExtratudo } from './aplicativos/extratudo/rotas';
import { rotasTarefas } from './aplicativos/tarefas/rotas';

const APLICATIVOS: Record<string, { nome: string; rotas: RouteObject[]; raiz: string }> = {
  'concilia-ai': { nome: 'Concilia aí', rotas: rotasConciliaAi, raiz: '/' },
  conciliadorzinho: { nome: 'Conciliadorzinho', rotas: rotasConciliadorzinho, raiz: '/conciliadorzinho' },
  // o catálogo de todas as peças do nads (Vitor, 02/10/2026), num link à parte
  componentes: { nome: 'Componentes', rotas: rotasComponentes, raiz: '/componentes' },
  extratudo: { nome: 'Extratudo', rotas: rotasExtratudo, raiz: '/extratudo' },
  // a Tarefas leva junto o Extratudo e a Conferência (a etapa Conferência fiscal): as ferramentas da etapa abrem
  // no mesmo endereço (o login do Entregas fica guardado no navegador; em outro endereço, dentro do iframe, o Brave apaga)
  tarefas: { nome: 'Tarefas', rotas: [...rotasTarefas, ...rotasExtratudo, ...rotasConciliaAiNaTarefa], raiz: '/tarefas' },
};

const so = APLICATIVOS[import.meta.env.VITE_APLICATIVO || ''];
if (so) document.title = so.nome + ' — Nilma';

export const roteador = createBrowserRouter(so
  ? [...so.rotas, ...(so.raiz !== '/' ? [{ path: '/', element: <Navigate to={so.raiz} replace /> }] : []), { path: '*', element: <Navigate to={so.raiz} replace /> }]
  : [
    ...rotasConciliadorzinho,
    ...rotasComponentes,
    ...rotasExtratudo,
    ...rotasTarefas,
    ...rotasConciliaAi,
    { path: '*', element: <Navigate to="/" replace /> },
  ]);
