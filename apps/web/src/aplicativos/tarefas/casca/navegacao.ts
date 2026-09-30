// Navegação da Tarefas: as aplicações ficam na gaveta ☰; a barra lateral mostra as páginas da
// aplicação aberta. Fiscal e Contábil aparecem para quem é do departamento (ou admin).
// URL: /tarefas/<aplicação>/<página>; a página de uma empresa é /tarefas/minhas-empresas/empresa/<empresa>;
// o executor das etapas é /tarefas/executar/<empresa>/<competência>.
// O Cadastro é a lista de empresas (/tarefas/cadastro/empresas); a empresa abre numa janela por cima da lista,
// com as abas dela: /tarefas/cadastro/empresas/<empresa>/<aba>.
import type { NomeIcone } from '@nads/ui';
import type { Operador } from './operador';

export const BASE = '/tarefas';

export type IdAplicacao = 'minhas-empresas' | 'contabil' | 'cadastro' | 'fiscal' | 'drive' | 'contato';

export interface Pagina { id: string; rotulo: string; icone: NomeIcone; titulo: string }
export interface Aplicacao { id: IdAplicacao; nome: string; icone: NomeIcone; paginas: Pagina[]; pronta: boolean }

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
];

/** As aplicações que a pessoa vê: Fiscal só para o Fiscal; Contábil, Drive e Gmail só para o Contábil (admin vê tudo). */
export function aplicacoesDe(op: Operador): Aplicacao[] {
  return APLICACOES.filter(a =>
    (a.id !== 'fiscal' || op.admin || op.departamento === 'fiscal') &&
    (a.id !== 'contabil' || op.admin || op.departamento === 'contabil') &&
    // o Drive e o Gmail do robô: as regras do Entregas só deixam o admin e o contábil lerem
    ((a.id !== 'drive' && a.id !== 'contato') || op.admin || op.departamento === 'contabil'));
}

export function aplicacao(id: string): Aplicacao | undefined {
  return APLICACOES.find(a => a.id === id);
}

export const caminhoDaPagina = (app: IdAplicacao, pagina: string) => BASE + '/' + app + '/' + pagina;
/** A página de uma empresa (insights dela): /tarefas/minhas-empresas/empresa/<código>?competencia=aaaa-mm */
export const caminhoDaEmpresa = (rotaEmpresa: string, competencia: string) => BASE + '/minhas-empresas/empresa/' + rotaEmpresa + '?competencia=' + competencia;
/** As abas da janela de uma empresa no Cadastro. */
export const ABAS_DO_CADASTRO: readonly { id: string; rotulo: string; icone: NomeIcone }[] = [
  { id: 'bancos', rotulo: 'Contas bancárias', icone: 'landmark' },
  { id: 'plano', rotulo: 'Plano de contas', icone: 'list' },
  { id: 'contas-padrao', rotulo: 'Contas padrão', icone: 'settings' },
  { id: 'historico', rotulo: 'Histórico', icone: 'clock' },
];

/** A lista do Cadastro (sem empresa) ou a janela de uma empresa, numa aba. */
export const caminhoDoCadastro = (rotaEmpresa: string | null, aba = 'bancos') =>
  BASE + '/cadastro/empresas' + (rotaEmpresa ? '/' + rotaEmpresa + '/' + aba : '');
export const caminhoDoExecutor = (rotaEmpresa: string, competencia: string) => BASE + '/executar/' + rotaEmpresa + '/' + competencia;
