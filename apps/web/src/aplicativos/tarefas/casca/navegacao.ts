// Navegação da Tarefas: as aplicações ficam na gaveta ☰; a barra lateral mostra as páginas da
// aplicação aberta. Fiscal e Contábil aparecem para quem é do departamento (ou admin).
// URL: /tarefas/<aplicação>/<página>; o executor das etapas é /tarefas/executar/<empresa>/<competência>.
import type { NomeIcone } from '@nads/ui';
import type { Operador } from './operador';

export const BASE = '/tarefas';

export type IdAplicacao = 'minhas-empresas' | 'contabil' | 'fiscal' | 'drive' | 'contato';

export interface Pagina { id: string; rotulo: string; icone: NomeIcone; titulo: string }
export interface Aplicacao { id: IdAplicacao; nome: string; icone: NomeIcone; paginas: Pagina[]; pronta: boolean }

export const APLICACOES: readonly Aplicacao[] = [
  { id: 'minhas-empresas', nome: 'Minhas empresas', icone: 'briefcase', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'list', titulo: 'Minhas empresas' },
  ] },
  { id: 'contabil', nome: 'Contábil', icone: 'checklist', pronta: true, paginas: [
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Contábil — visão geral' },
    { id: 'paradas', rotulo: 'Paradas', icone: 'alert', titulo: 'Contábil — etapas paradas' },
  ] },
  { id: 'fiscal', nome: 'Fiscal', icone: 'fileText', pronta: false, paginas: [
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Fiscal' },
  ] },
  { id: 'drive', nome: 'Drive', icone: 'fileDown', pronta: false, paginas: [
    { id: 'arquivos', rotulo: 'Arquivos', icone: 'fileDown', titulo: 'Drive' },
  ] },
  { id: 'contato', nome: 'Contato', icone: 'link', pronta: false, paginas: [
    { id: 'caixa', rotulo: 'Caixa de entrada', icone: 'link', titulo: 'Contato' },
  ] },
];

/** As aplicações que a pessoa vê: Fiscal só para o Fiscal, Contábil só para o Contábil (admin vê as duas). */
export function aplicacoesDe(op: Operador): Aplicacao[] {
  return APLICACOES.filter(a =>
    (a.id !== 'fiscal' || op.admin || op.departamento === 'fiscal') &&
    (a.id !== 'contabil' || op.admin || op.departamento === 'contabil'));
}

export function aplicacao(id: string): Aplicacao | undefined {
  return APLICACOES.find(a => a.id === id);
}

export const caminhoDaPagina = (app: IdAplicacao, pagina: string) => BASE + '/' + app + '/' + pagina;
export const caminhoDoExecutor = (rotaEmpresa: string, competencia: string) => BASE + '/executar/' + rotaEmpresa + '/' + competencia;
