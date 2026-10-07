// As telas do nads (o menu lateral do catálogo), por aplicativo.
import type { IdTipo, Tela, Tipo } from './tipos';

export const TIPOS: Tipo[] = [
  { id: 'botoes', prefixo: 'BT', nome: 'Botões', icone: 'zap', descricao: 'Todos os botões: de texto, de ícone, do cabeçalho, das etapas' },
  { id: 'selos', prefixo: 'SE', nome: 'Selos', icone: 'checkCircle', descricao: 'Ok, Conferido, diferença, situações e etiquetas' },
  { id: 'icones', prefixo: 'IC', nome: 'Ícones', icone: 'grade', descricao: 'Os ícones do sistema (traço 1,75) e a marca' },
  { id: 'logos', prefixo: 'LG', nome: 'Logos', icone: 'landmark', descricao: 'Bancos, aplicativos e a Nilma' },
  { id: 'campos', prefixo: 'CP', nome: 'Campos', icone: 'fileText', descricao: 'Busca, texto, seleção, checkbox, interruptor, data, mês e arquivo' },
  { id: 'tabelas', prefixo: 'TB', nome: 'Tabelas', icone: 'list', descricao: 'Tabelas, linhas e células' },
  { id: 'menus', prefixo: 'MN', nome: 'Menus suspensos', icone: 'caretDown', descricao: 'Todos os menus que abrem de um botão (▾)' },
  { id: 'janelas', prefixo: 'JN', nome: 'Janelas', icone: 'maximizar', descricao: 'Todas as janelas (popups) do sistema' },
  { id: 'avisos', prefixo: 'AV', nome: 'Avisos', icone: 'alert', descricao: 'Alertas, toasts, mensagens flutuantes e faixas' },
  { id: 'abas', prefixo: 'AB', nome: 'Abas', icone: 'painel', descricao: 'Abas, segmentados, passos e trilhas' },
  { id: 'cabecalhos', prefixo: 'CB', nome: 'Cabeçalhos', icone: 'menu', descricao: 'O cabeçalho de cada página' },
  { id: 'laterais', prefixo: 'LT', nome: 'Menus laterais', icone: 'chevronsLeft', descricao: 'A barra lateral de cada página' },
  { id: 'cartoes', prefixo: 'CT', nome: 'Cartões', icone: 'cartao', descricao: 'Cartões, números, caixas e painéis' },
  { id: 'listas', prefixo: 'LS', nome: 'Listas', icone: 'checklist', descricao: 'Listas, checklists, chips e contadores' },
  { id: 'carregamento', prefixo: 'CR', nome: 'Carregamento', icone: 'girar', descricao: 'Barra do topo, rodinha, esqueleto e a abertura com o N' },
  { id: 'graficos', prefixo: 'GR', nome: 'Gráficos', icone: 'barChart', descricao: 'Barras, ranking, progresso e grade de períodos' },
  { id: 'cores', prefixo: 'CO', nome: 'Cores', icone: 'sun', descricao: 'As cores do sistema (claro e escuro) e o seletor de tema' },
];

export const TELAS: Tela[] = [
  // Tarefas
  { id: 't-entrar', app: 'Tarefas', nome: 'Entrar' },
  { id: 't-empresas', app: 'Tarefas', nome: 'Minhas empresas' },
  { id: 't-senhas', app: 'Tarefas', nome: 'Senhas (gov.br e certificados)' },
  { id: 't-dp-fgts', app: 'Tarefas', nome: 'DP › FGTS Digital' },
  { id: 't-insights', app: 'Tarefas', nome: 'Insights' },
  { id: 't-contabil', app: 'Tarefas', nome: 'Contábil' },
  { id: 't-empresa', app: 'Tarefas', nome: 'Página da empresa' },
  { id: 't-exec-importacao', app: 'Tarefas', nome: 'Executor › Importação' },
  { id: 't-exec-cheque', app: 'Tarefas', nome: 'Executor › Cheque especial' },
  { id: 't-exec-fiscal', app: 'Tarefas', nome: 'Executor › Conferência fiscal' },
  { id: 't-exec-folha', app: 'Tarefas', nome: 'Executor › Contabilização da Folha' },
  { id: 't-exec-bancos', app: 'Tarefas', nome: 'Executor › Relatório Bancário' },
  { id: 't-exec-clientes', app: 'Tarefas', nome: 'Executor › Clientes' },
  { id: 't-exec-fiscal-rotina', app: 'Tarefas', nome: 'Executor › Rotina do Fiscal (checklist disfarçada)' },
  { id: 't-cadastro', app: 'Tarefas', nome: 'Cadastro (lista)' },
  { id: 't-cadastro-janela', app: 'Tarefas', nome: 'Cadastro › Janela da empresa' },
  { id: 't-cadastro-config', app: 'Tarefas', nome: 'Cadastro › Configurações' },
  { id: 't-drive', app: 'Tarefas', nome: 'Drive' },
  { id: 't-gmail', app: 'Tarefas', nome: 'Gmail' },
  { id: 't-mandei', app: 'Tarefas', nome: 'Mandei (tickets)' },
  // Mandei: o formulário que o cliente abre pelo link
  { id: 'm-formulario', app: 'Mandei', nome: 'Formulário do cliente' },
  // Extratudo
  { id: 'e-entrada', app: 'Extratudo', nome: 'Entrar no Extratudo' },
  { id: 'e-importacao', app: 'Extratudo', nome: 'Extrator › Importação (bancos)' },
  { id: 'e-arquivos', app: 'Extratudo', nome: 'Extrator › Arquivos' },
  { id: 'e-conferencia', app: 'Extratudo', nome: 'Extrator › Extrato × sistema' },
  { id: 'e-historico', app: 'Extratudo', nome: 'Extrator › Histórico' },
  { id: 'e-cheque', app: 'Extratudo', nome: 'Cheque especial' },
  { id: 'e-creditor', app: 'Extratudo', nome: 'Creditor' },
  // Concilia aí
  { id: 'c-entrada', app: 'Concilia aí', nome: 'Entrar' },
  { id: 'c-importacao', app: 'Concilia aí', nome: 'Importação' },
  { id: 'c-relatorio', app: 'Concilia aí', nome: 'Relatório' },
  { id: 'c-naturezas', app: 'Concilia aí', nome: 'Naturezas de CFOP' },
  { id: 'c-verificar', app: 'Concilia aí', nome: 'Verificar por conta' },
  { id: 'c-consulta', app: 'Concilia aí', nome: 'Consulta' },
  { id: 'c-cadastro', app: 'Concilia aí', nome: 'Cadastro › Configurações' },
  { id: 'c-auditoria', app: 'Concilia aí', nome: 'Auditoria' },
  // Conciliadorzinho
  { id: 'z-entrada', app: 'Conciliadorzinho', nome: 'Entrar' },
  { id: 'z-etapas', app: 'Conciliadorzinho', nome: 'Conciliação (etapas)' },
];

/** Atalhos de grupos de telas (para dizer "em todas as telas de…"). */
const tudoDe = (app: string) => TELAS.filter(t => t.app === app).map(t => t.id);
export const TODAS = TELAS.map(t => t.id);
export const TAREFAS = tudoDe('Tarefas');
export const EXTRATUDO = tudoDe('Extratudo');
export const CONCILIA = tudoDe('Concilia aí');
export const EXECUTOR = ['t-exec-importacao', 't-exec-cheque', 't-exec-fiscal', 't-exec-folha', 't-exec-bancos', 't-exec-clientes', 't-exec-fiscal-rotina'];

export type { IdTipo };
