// Rotas do nads: quatro aplicativos separados, cada um com as suas rotas (aplicativos/<app>/rotas.tsx).
//   Concilia aí (a Conferência) ... /  e  /<código>/<seção>/<página>
//   Conciliadorzinho ............. /conciliadorzinho/…
//   Extratudo .................... /extratudo/<código>/<ferramenta>/…  (Extrator, Cheque especial, Creditor)
//   Conversor .................... /conversor/<etapa>  (extrato → .xls)
//   Tarefas ...................... /tarefas/<aplicação>/<página>  e  /tarefas/executar/<código>/<competência>
//   Área do Cliente .............. /cliente/<token>/<aba>  (o link secreto da empresa, Vitor, 16/10/2026)
//   Admin ........................ /admin/<página>  (só para admin: o robô, o uso, a saúde do banco; Vitor, 21/10/2026)
// São caminhos de verdade na URL; a hospedagem (firebase.json) reescreve qualquer caminho para index.html.
//
// VITE_APLICATIVO=<id> gera um site com UM aplicativo só (o link de cada um): as rotas dos outros
// nem entram, e a raiz leva direto a ele. Sem a variável, entram os quatro.
//
// "Nem entram" de verdade (revisão da UI, 18/10/2026): antes a tabela abaixo citava as rotas de todos, e o site da Tarefas
// levava junto o Conciliadorzinho, a Área do Cliente e o Conversor. Agora cada aplicativo só é citado quando o site é
// dele: a comparação com o VITE_APLICATIVO vira true/false na compilação (como em componentes/rotas.tsx) e o código dos
// outros nem é gerado.
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { rotasAdmin } from './aplicativos/admin/rotas';
import { rotasConciliaAi, rotasConciliaAiNaTarefa } from './aplicativos/concilia-ai/rotas';
import { rotasComponentes } from './aplicativos/componentes/rotas';
import { rotasConciliadorzinho } from './aplicativos/conciliadorzinho/rotas';
import { rotasCliente } from './aplicativos/cliente/rotas';
import { rotasConversor } from './aplicativos/conversor/rotas';
import { rotasExtratudo } from './aplicativos/extratudo/rotas';
import { rotasTarefas } from './aplicativos/tarefas/rotas';
import { rotasMandei } from './aplicativos/mandei/rotas';
import { ErroDaTela } from './comum/ErroDaTela';

const SO = import.meta.env.VITE_APLICATIVO || '';
const TODOS = !SO;
const APLICATIVOS: Record<string, { nome: string; rotas: RouteObject[]; raiz: string }> = {
  'concilia-ai': { nome: 'Concilia aí', rotas: SO === 'concilia-ai' ? rotasConciliaAi : [], raiz: '/' },
  conciliadorzinho: { nome: 'Conciliadorzinho', rotas: SO === 'conciliadorzinho' ? rotasConciliadorzinho : [], raiz: '/conciliadorzinho' },
  // o catálogo de todas as peças do nads (Vitor, 02/10/2026), num link à parte
  componentes: { nome: 'Componentes', rotas: SO === 'componentes' ? rotasComponentes : [], raiz: '/componentes' },
  extratudo: { nome: 'Extratudo', rotas: SO === 'extratudo' ? rotasExtratudo : [], raiz: '/extratudo' },
  // extrato do banco → .xls no layout do escritório, num link à parte e sem banco de dados (Vitor, 06/10/2026)
  conversor: { nome: 'Conversor', rotas: SO === 'conversor' ? rotasConversor : [], raiz: '/conversor' },
  // o formulário do cliente (o link do ticket do Mandei, Vitor, 07/10/2026), num site próprio
  mandei: { nome: 'Mandei', rotas: SO === 'mandei' ? rotasMandei : [], raiz: '/mandei' },
  // a Área do Cliente (Vitor, 16/10/2026): o link secreto de cada empresa, sem senha, num site próprio (fora da Tarefas)
  cliente: { nome: 'Área do Cliente', rotas: SO === 'cliente' ? rotasCliente : [], raiz: '/cliente' },
  // o site só para admin (Vitor, 21/10/2026); no build do site, o rotasDoAdmin.tsx entra no lugar deste arquivo
  admin: { nome: 'Admin', rotas: SO === 'admin' ? rotasAdmin : [], raiz: '/admin' },
  // a Tarefas leva junto o Extratudo e a Conferência (a etapa Conferência fiscal): as ferramentas da etapa abrem
  // no mesmo endereço (o login do Entregas fica guardado no navegador; em outro endereço, dentro do iframe, o Brave apaga)
  tarefas: { nome: 'Tarefas', rotas: SO === 'tarefas' ? [...rotasTarefas, ...rotasExtratudo, ...rotasConciliaAiNaTarefa, ...rotasMandei] : [], raiz: '/tarefas' },
};

const so = APLICATIVOS[SO];
// a tela que quebra mostra o ErroDaTela (revisão da UI, 18/10/2026), em todas as rotas de cima
const comErro = (rs: RouteObject[]): RouteObject[] => rs.map(r => (r.errorElement ? r : { ...r, errorElement: <ErroDaTela /> }));
if (so) document.title = so.nome + ' — Nilma';

export const roteador = createBrowserRouter(comErro(so
  ? [...so.rotas, ...(so.raiz !== '/' ? [{ path: '/', element: <Navigate to={so.raiz} replace /> }] : []), { path: '*', element: <Navigate to={so.raiz} replace /> }]
  : !TODOS ? [] : [
    ...rotasConciliadorzinho,
    ...rotasConversor,
    ...rotasMandei,
    ...rotasCliente,
    ...rotasAdmin,
    ...rotasComponentes,
    ...rotasExtratudo,
    ...rotasTarefas,
    ...rotasConciliaAi,
    { path: '*', element: <Navigate to="/" replace /> },
  ]));
