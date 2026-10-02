// Navegação da Tarefas: as aplicações ficam na gaveta ☰; a barra lateral mostra as páginas da
// aplicação aberta. Fiscal e Contábil aparecem para quem é do departamento (ou admin).
// URL: /tarefas/<aplicação>/<página>; a página de uma empresa é /tarefas/minhas-empresas/empresa/<empresa>;
// o executor das etapas é /tarefas/executar/<empresa>/<competência>.
// O Cadastro é a lista de empresas (/tarefas/cadastro/empresas); a empresa abre numa janela por cima da lista,
// com as abas dela: /tarefas/cadastro/empresas/<empresa>/<aba>.
import type { NomeIcone } from '@nads/ui';
import type { Operador } from './operador';

export const BASE = '/tarefas';

export type IdAplicacao = 'minhas-empresas' | 'contabil' | 'cadastro' | 'fiscal' | 'drive' | 'contato' | 'pessoal';

export interface Pagina { id: string; rotulo: string; icone: NomeIcone; titulo: string }
export interface Aplicacao {
  id: IdAplicacao; nome: string; icone: NomeIcone; paginas: Pagina[]; pronta: boolean;
  /** fora da gaveta ☰ (a Minha página abre pelo avatar do cabeçalho) */
  foraDaGaveta?: boolean;
  /** o grupo de cada página na lateral (o título em cima do grupo), como nas Configurações do Entregas */
  grupos?: Record<string, string>;
}

export const APLICACOES: readonly Aplicacao[] = [
  { id: 'minhas-empresas', nome: 'Minhas empresas', icone: 'briefcase', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'list', titulo: 'Minhas empresas' },
    { id: 'insights', rotulo: 'Insights', icone: 'barChart', titulo: 'Minhas empresas — insights' },
  ] },
  { id: 'contabil', nome: 'Contábil', icone: 'checklist', pronta: true, paginas: [
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Contábil — visão geral' },
    { id: 'paradas', rotulo: 'Paradas', icone: 'alert', titulo: 'Contábil — etapas paradas' },
  ] },
  { id: 'cadastro', nome: 'Cadastro', icone: 'landmark', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase', titulo: 'Cadastro — empresas' },
    { id: 'usuarios', rotulo: 'Usuários', icone: 'checklist', titulo: 'Cadastro — usuários' },
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Cadastro — configurações' },
  ] },
  { id: 'fiscal', nome: 'Fiscal', icone: 'fileText', pronta: false, paginas: [
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Fiscal' },
  ] },
  { id: 'drive', nome: 'Drive', icone: 'pasta', pronta: true, paginas: [
    { id: 'pastas', rotulo: 'Pastas', icone: 'pasta', titulo: 'Drive — pasta do ano' },
  ] },
  { id: 'contato', nome: 'Gmail', icone: 'envelope', pronta: true, paginas: [
    { id: 'caixa', rotulo: 'E-mails', icone: 'envelope', titulo: 'Gmail — e-mails do robô' },
    { id: 'historico', rotulo: 'Histórico', icone: 'clock', titulo: 'Gmail — execuções do robô' },
  ] },
  // a página pessoal (Vitor, 02/10/2026: "a página pessoal, com configs, inbox dentre outros, no estilo do Entregas"):
  // abre pelo avatar no canto do cabeçalho; os tópicos na lateral, em grupos, como as Configurações do Entregas
  { id: 'pessoal', nome: 'Minha página', icone: 'usuario', pronta: true, foraDaGaveta: true, paginas: [
    { id: 'caixa', rotulo: 'Caixa de entrada', icone: 'caixaEntrada', titulo: 'Caixa de entrada' },
    { id: 'conta', rotulo: 'Minha conta', icone: 'usuario', titulo: 'Minha conta' },
    { id: 'computador', rotulo: 'Este computador', icone: 'monitor', titulo: 'Este computador' },
    { id: 'preferencias', rotulo: 'Aparência e telas', icone: 'settings', titulo: 'Aparência e telas' },
    { id: 'aplicativo', rotulo: 'Versão do sistema', icone: 'download', titulo: 'Versão do sistema' },
  ], grupos: { caixa: '', conta: 'Conta', computador: 'Conta', preferencias: 'Preferências', aplicativo: 'Aplicativo' } },
];

/** As aplicações que a pessoa vê: Fiscal só para o Fiscal; Contábil e Drive só para o Contábil; Gmail para os dois (admin vê tudo). */
export function aplicacoesDe(op: Operador): Aplicacao[] {
  return APLICACOES.filter(a =>
    (a.id !== 'fiscal' || op.admin || op.departamento === 'fiscal') &&
    (a.id !== 'contabil' || op.admin || op.departamento === 'contabil') &&
    // o Drive do robô: as regras do Entregas só deixam o admin e o contábil lerem; o Gmail (01/10/2026): o contábil
    // e o fiscal (cada um vê a caixa da Nilma e a do próprio setor)
    (a.id !== 'drive' || op.admin || op.departamento === 'contabil') &&
    (a.id !== 'contato' || op.admin || op.departamento === 'contabil' || op.departamento === 'fiscal'));
}

export function aplicacao(id: string): Aplicacao | undefined {
  return APLICACOES.find(a => a.id === id);
}

export const caminhoDaPagina = (app: IdAplicacao, pagina: string) => BASE + '/' + app + '/' + pagina;
/** Onde a Tarefas abre (a pessoa escolhe na Minha página › Aparência e telas; fica neste navegador). */
export const CHAVE_INICIO = 'nads-tarefas-inicio';
export const INICIOS: readonly { valor: string; rotulo: string; caminho: string }[] = [
  { valor: 'empresas', rotulo: 'Minhas empresas', caminho: BASE + '/minhas-empresas/empresas' },
  { valor: 'caixa', rotulo: 'Caixa de entrada', caminho: BASE + '/pessoal/caixa' },
  { valor: 'drive', rotulo: 'Drive', caminho: BASE + '/drive/pastas' },
  { valor: 'gmail', rotulo: 'Gmail', caminho: BASE + '/contato/caixa' },
];
export function inicioEscolhido(): string {
  try { return localStorage.getItem(CHAVE_INICIO) || 'empresas'; } catch { return 'empresas'; }
}
export function caminhoDoInicio(op: { departamento: string; admin: boolean }): string {
  const i = INICIOS.find(x => x.valor === inicioEscolhido()) || INICIOS[0];
  // o Drive e o Gmail têm dono (departamento): sem acesso, abre em Minhas empresas
  if (i.valor === 'drive' && !op.admin && op.departamento !== 'contabil') return INICIOS[0].caminho;
  if (i.valor === 'gmail' && !op.admin && op.departamento !== 'contabil' && op.departamento !== 'fiscal') return INICIOS[0].caminho;
  return i.caminho;
}
/** A página de uma empresa (insights dela): /tarefas/minhas-empresas/empresa/<código>?competencia=aaaa-mm */
export const caminhoDaEmpresa = (rotaEmpresa: string, competencia: string) => BASE + '/minhas-empresas/empresa/' + rotaEmpresa + '?competencia=' + competencia;
/** As abas da janela de uma empresa no Cadastro. */
export const ABAS_DO_CADASTRO: readonly { id: string; rotulo: string; icone: NomeIcone }[] = [
  { id: 'empresa', rotulo: 'Empresa', icone: 'briefcase' },
  { id: 'bancos', rotulo: 'Contas bancárias', icone: 'landmark' },
  { id: 'plano', rotulo: 'Plano de contas', icone: 'list' },
  { id: 'contas-padrao', rotulo: 'Contas padrão', icone: 'settings' },
  { id: 'historico', rotulo: 'Histórico', icone: 'clock' },
];

/** A lista do Cadastro (sem empresa) ou a janela de uma empresa, numa aba. */
export const caminhoDoCadastro = (rotaEmpresa: string | null, aba = 'bancos') =>
  BASE + '/cadastro/empresas' + (rotaEmpresa ? '/' + rotaEmpresa + '/' + aba : '');
export const caminhoDoExecutor = (rotaEmpresa: string, competencia: string) => BASE + '/executar/' + rotaEmpresa + '/' + competencia;
