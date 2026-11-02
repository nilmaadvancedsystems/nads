// Rotas da Tarefas: /tarefas/<aplicação>/<página> (Minhas empresas, Contábil, Fiscal, Drive, Contato)
// a página de cada empresa (/tarefas/minhas-empresas/empresa/<código>), o Cadastro (a lista e a janela de uma empresa:
// /tarefas/cadastro/empresas/<código>/<aba>)
// e o executor em tela cheia: /tarefas/executar/<código da empresa>/<competência aaaa-mm>. A prévia da abertura:
// /tarefas/previa/abertura; a das animações (os três jeitos): /tarefas/previa/animacoes.
//
// O executor, a página da empresa, o Cadastro, o convite e as prévias são pedaços à parte (revisão da UI, 18/10/2026):
// só baixam quando a pessoa abre (comum/pedaco.tsx). As telas das aplicações viram pedaços na AplicacaoAberta.
import { Navigate, type RouteObject } from 'react-router';
import { NaEspera, pedaco } from '../../comum/pedaco';
import { AppTarefas } from './AppTarefas';
import { AplicacaoAberta } from './casca/AplicacaoAberta';
import { BASE, caminhoDoInicio } from './casca/navegacao';
import { useOperador, type Operador } from './casca/operador';

const CadastroAberto = pedaco(() => import('./casca/CadastroAberto'), 'CadastroAberto');
const CadastroAntigo = pedaco(() => import('./casca/CadastroAberto'), 'CadastroAntigo');
const EmpresaAberta = pedaco(() => import('./casca/EmpresaAberta'), 'EmpresaAberta');
const ConviteDoNads = pedaco(() => import('./telas/convite/ConviteDoNads'), 'ConviteDoNads');
const Executor = pedaco(() => import('./telas/executor/Executor'), 'Executor');
const PreviaAbertura = pedaco(() => import('./telas/previa/PreviaAbertura'), 'PreviaAbertura');
const PreviaAnimacoes = pedaco(() => import('./telas/previa/PreviaAnimacoes'), 'PreviaAnimacoes');

function Inicio() {
  const op = useOperador().operador as Operador;
  return <Navigate to={caminhoDoInicio(op)} replace />;
}

export const rotasTarefas: RouteObject[] = [
  // a prévia da abertura (a animação da logo), sem login
  { path: BASE + '/previa/abertura', element: <NaEspera inteira><PreviaAbertura /></NaEspera> },
  { path: BASE + '/previa/animacoes', element: <NaEspera inteira><PreviaAnimacoes /></NaEspera> },
  // o convite (15/10/2026): criar a conta ou trocar a senha pelo link que o admin gerou, sem login
  { path: BASE + '/convite/:codigo', element: <NaEspera inteira><ConviteDoNads /></NaEspera> },
  {
    path: BASE,
    element: <AppTarefas />,
    children: [
      // onde a Tarefas abre: a pessoa escolhe na Minha página › Aparência e telas (padrão: o Início, 27/10/2026)
      { index: true, element: <Inicio /> },
      { path: 'executar/:empresa/:competencia', element: <NaEspera inteira><Executor /></NaEspera> },
      { path: 'minhas-empresas/empresa/:empresa', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
      // o endereço antigo do LCDPR na página da empresa (16/10/2026): volta para a página da empresa (o LCDPR agora é a
      // etapa do executor)
      { path: 'minhas-empresas/empresa/:empresa/lcdpr/:lcdpr', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
      // as páginas da empresa aberta (27/10/2026): Tarefas, Visão geral, Drive e, no Fiscal, as ferramentas
      { path: 'minhas-empresas/empresa/:empresa/:pagina', element: <NaEspera inteira><EmpresaAberta /></NaEspera> },
      // a lista e a janela usam o mesmo componente: a lista (e a busca dela) fica montada atrás da janela
      { path: 'cadastro/empresas', element: <NaEspera inteira><CadastroAberto /></NaEspera> },
      { path: 'cadastro/empresas/:empresa/:aba', element: <NaEspera inteira><CadastroAberto /></NaEspera> },
      { path: 'cadastro/:empresa/:aba', element: <NaEspera inteira><CadastroAntigo /></NaEspera> },
      { path: ':app/:pagina', element: <AplicacaoAberta /> },
      { path: ':app', element: <AplicacaoAberta /> },
    ],
  },
];
