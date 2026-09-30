// Rotas da Tarefas: /tarefas/<aplicação>/<página> (Minhas empresas, Contábil, Fiscal, Drive, Contato)
// a página de cada empresa (/tarefas/minhas-empresas/empresa/<código>), o Cadastro (a lista e a janela de uma empresa:
// /tarefas/cadastro/empresas/<código>/<aba>)
// e o executor em tela cheia: /tarefas/executar/<código da empresa>/<competência aaaa-mm>.
import { Navigate, type RouteObject } from 'react-router';
import { AppTarefas } from './AppTarefas';
import { AplicacaoAberta } from './casca/AplicacaoAberta';
import { CadastroAberto, CadastroAntigo } from './casca/CadastroAberto';
import { EmpresaAberta } from './casca/EmpresaAberta';
import { BASE, caminhoDaPagina } from './casca/navegacao';
import { Executor } from './telas/executor/Executor';

export const rotasTarefas: RouteObject[] = [
  {
    path: BASE,
    element: <AppTarefas />,
    children: [
      { index: true, element: <Navigate to={caminhoDaPagina('minhas-empresas', 'empresas')} replace /> },
      { path: 'executar/:empresa/:competencia', element: <Executor /> },
      { path: 'minhas-empresas/empresa/:empresa', element: <EmpresaAberta /> },
      // a lista e a janela usam o mesmo componente: a lista (e a busca dela) fica montada atrás da janela
      { path: 'cadastro/empresas', element: <CadastroAberto /> },
      { path: 'cadastro/empresas/:empresa/:aba', element: <CadastroAberto /> },
      { path: 'cadastro/:empresa/:aba', element: <CadastroAntigo /> },
      { path: ':app/:pagina', element: <AplicacaoAberta /> },
      { path: ':app', element: <AplicacaoAberta /> },
    ],
  },
];
