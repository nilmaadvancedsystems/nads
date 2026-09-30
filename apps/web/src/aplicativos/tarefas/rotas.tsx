// Rotas da Tarefas: /tarefas/<aplicação>/<página> (Minhas empresas, Contábil, Fiscal, Drive, Contato)
// a página de cada empresa (/tarefas/minhas-empresas/empresa/<código>), o Cadastro de uma empresa (/tarefas/cadastro/<código>/<página>)
// e o executor em tela cheia: /tarefas/executar/<código da empresa>/<competência aaaa-mm>.
import { Navigate, type RouteObject } from 'react-router';
import { AppTarefas } from './AppTarefas';
import { AplicacaoAberta } from './casca/AplicacaoAberta';
import { CadastroAberto } from './casca/CadastroAberto';
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
      { path: 'cadastro/:empresa/:pagina', element: <CadastroAberto /> },
      { path: ':app/:pagina', element: <AplicacaoAberta /> },
      { path: ':app', element: <AplicacaoAberta /> },
    ],
  },
];
