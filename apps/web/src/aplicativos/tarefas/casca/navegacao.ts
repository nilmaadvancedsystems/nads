// Navegação da Tarefas: as aplicações ficam na gaveta ☰; a barra lateral mostra as páginas da
// aplicação aberta. Fiscal e Contábil aparecem para quem é do departamento (ou admin).
// URL: /tarefas/<aplicação>/<página>; a página de uma empresa é /tarefas/minhas-empresas/empresa/<empresa>;
// o executor das etapas é /tarefas/executar/<empresa>/<competência>.
// O Cadastro é a lista de empresas (/tarefas/cadastro/empresas); a empresa abre numa janela por cima da lista,
// com as abas dela: /tarefas/cadastro/empresas/<empresa>/<aba>.
import { tarefas as t } from '@nads/core';
import type { NomeIcone } from '@nads/ui';
import type { Operador } from './operador';

export const BASE = '/tarefas';

export type IdAplicacao = 'minhas-empresas' | 'contabil' | 'cadastro' | 'fiscal' | 'dp' | 'senhas' | 'drive' | 'contato' | 'mandei';

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
    // os históricos do Creditor, os mesmos para todas as empresas (Vitor, 05/10/2026)
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Contábil — configurações' },
  ] },
  { id: 'cadastro', nome: 'Cadastro', icone: 'landmark', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase', titulo: 'Cadastro — empresas' },
    { id: 'usuarios', rotulo: 'Usuários', icone: 'checklist', titulo: 'Cadastro — usuários' },
    // o que a equipe mandou pelo Enviar feedback (o print e o que melhorar; Vitor, 07/10/2026)
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Cadastro — configurações' },
  ] },
  // o Fiscal no mesmo modelo do Contábil (Vitor, 05/10/2026): as empresas com a rotina do Fiscal, a visão e as paradas
  { id: 'fiscal', nome: 'Fiscal', icone: 'fileText', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'list', titulo: 'Fiscal — empresas' },
    // o Painel (Vitor, 09/10/2026): todos os clientes do mês numa tela, com o que a rotina e o SIEG apontam
    { id: 'painel', rotulo: 'Painel', icone: 'painel', titulo: 'Fiscal — painel' },
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Fiscal — visão geral' },
    // a REINF (o fluxo do Notion do Heverton), logo abaixo da Visão geral
    { id: 'reinf', rotulo: 'REINF', icone: 'fileUp', titulo: 'Fiscal — REINF' },
    { id: 'paradas', rotulo: 'Paradas', icone: 'alert', titulo: 'Fiscal — etapas paradas' },
  ] },
  // o DP (Vitor, 06/10/2026: o Checklist Folha "seria a rotina do dp"): as empresas com a rotina do DP, o painel da
  // planilha (números, gráficos, o progresso por responsável e as obrigações de cada cliente), a visão e as paradas
  { id: 'dp', nome: 'Departamento Pessoal', icone: 'usuario', pronta: true, paginas: [
    // tudo no tabelão (Vitor, 06/10/2026: "sem a parte de checklist"); as páginas na barra lateral ("eu ainda quero uma
    // barra lateral"); em Obrigações, uma tabela só, com as colunas agrupadas (Folha, eSocial, Guias, REINF, Entrega)
    { id: 'resumo', rotulo: 'Resumo', icone: 'painel', titulo: 'DP — resumo do mês' },
    { id: 'obrigacoes', rotulo: 'Obrigações', icone: 'checklist', titulo: 'DP — obrigações do mês' },
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'DP — visão geral' },
    // a guia do FGTS Digital pelo robô da nuvem, com o certificado do escritório (Vitor, 07/10/2026)
    { id: 'fgts', rotulo: 'FGTS Digital', icone: 'fileDown', titulo: 'DP — guias do FGTS Digital' },
    // os parâmetros de cada cliente (Vitor, 06/10/2026: "quero que o dp tenha a própria aba de configurações")
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'DP — configurações' },
  ] },
  // as senhas gov.br e os certificados digitais, no cofre com a chave por pessoa (Vitor, 07/10/2026); todo o escritório
  { id: 'senhas', nome: 'Senhas', icone: 'lock', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase', titulo: 'Senhas — gov.br e certificados' },
    // o painel dos certificados: próximos a vencer, vencidos e válidos (07/10/2026)
    { id: 'certificados', rotulo: 'Certificados', icone: 'barChart', titulo: 'Senhas — certificados' },
    // as contas gov.br de pessoas (CPF), importadas da planilha (Vitor, 07/10/2026)
    { id: 'gov', rotulo: 'Contas gov.br', icone: 'usuario', titulo: 'Senhas — contas gov.br' },
    { id: 'acesso', rotulo: 'Acesso', icone: 'usuario', titulo: 'Senhas — acesso ao cofre' },
  ] },
  // os tickets mandados aos clientes (Vitor, 07/10/2026): os meus e a central de todos
  { id: 'mandei', nome: 'Mandei', icone: 'caixaEntrada', pronta: true, paginas: [
    { id: 'meus', rotulo: 'Meus tickets', icone: 'usuario', titulo: 'Mandei — meus tickets' },
    { id: 'central', rotulo: 'Central', icone: 'list', titulo: 'Mandei — central de tickets' },
  ] },
  { id: 'drive', nome: 'Drive', icone: 'pasta', pronta: true, paginas: [
    { id: 'pastas', rotulo: 'Pastas', icone: 'pasta', titulo: 'Drive — pasta do ano' },
  ] },
  { id: 'contato', nome: 'Gmail', icone: 'envelope', pronta: true, paginas: [
    { id: 'caixa', rotulo: 'E-mails', icone: 'envelope', titulo: 'Gmail — e-mails do robô' },
    { id: 'historico', rotulo: 'Histórico', icone: 'clock', titulo: 'Gmail — execuções do robô' },
  ] },
];

/** As aplicações que a pessoa vê: Fiscal só para o Fiscal; Contábil e Drive só para o Contábil; Gmail para os dois (admin vê tudo). */
export function aplicacoesDe(op: Operador): Aplicacao[] {
  return APLICACOES.filter(a =>
    (a.id !== 'fiscal' || op.admin || op.departamento === 'fiscal') &&
    (a.id !== 'dp' || op.admin || op.departamento === 'dp') &&
    (a.id !== 'contabil' || op.admin || op.departamento === 'contabil') &&
    // o Drive do robô: as regras do Entregas só deixam o admin e o contábil lerem; o Gmail (01/10/2026): o contábil
    // e o fiscal (cada um vê a caixa da Nilma e a do próprio setor)
    (a.id !== 'drive' || op.admin || op.departamento === 'contabil') &&
    (a.id !== 'contato' || op.admin || op.departamento === 'contabil' || op.departamento === 'fiscal') &&
    // o Cadastro (empresas, usuários e configurações): só o admin e o diretor (Vitor, 05/10/2026)
    (a.id !== 'cadastro' || op.admin || op.nivel === 'diretor'));
}

export function aplicacao(id: string): Aplicacao | undefined {
  return APLICACOES.find(a => a.id === id);
}

export const caminhoDaPagina = (app: IdAplicacao, pagina: string) => BASE + '/' + app + '/' + pagina;

/** Onde a Tarefas abre (a pessoa escolhe na Minha página, a janela do avatar › Aparência e telas; neste navegador). */
export const CHAVE_INICIO = 'nads-tarefas-inicio';
export const INICIOS: readonly { valor: string; rotulo: string; caminho: string }[] = [
  { valor: 'empresas', rotulo: 'Minhas empresas', caminho: BASE + '/minhas-empresas/empresas' },
  { valor: 'drive', rotulo: 'Drive', caminho: BASE + '/drive/pastas' },
  { valor: 'gmail', rotulo: 'Gmail', caminho: BASE + '/contato/caixa' },
];
/** A competência em que as telas abrem (Minhas empresas, a página da empresa, o Contábil): a anterior (padrão) ou a atual. */
export const CHAVE_COMPETENCIA = 'nads-tarefas-competencia';
export function competenciaEscolhida(): 'anterior' | 'atual' {
  try { return localStorage.getItem(CHAVE_COMPETENCIA) === 'atual' ? 'atual' : 'anterior'; } catch { return 'anterior'; }
}
/** As competências do seletor das telas: as recentes (a primeira é a que abre); com "atual", o mês corrente em primeiro. */
export function competenciasDaTela(n: number): string[] {
  const base = t.competenciasRecentes(new Date(), n);
  if (competenciaEscolhida() !== 'atual') return base;
  const d = new Date();
  const atual = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return [atual, ...base.filter(c => c !== atual)].slice(0, n);
}
/**
 * As competências do DP (08/10/2026: "no dp, a partir do dia 20, já tem que poder selecionar a competência do próximo
 * mês"): as da tela e, do dia 20 em diante, também o mês corrente (a folha que está fechando), no topo da lista. A que
 * abre continua a de sempre (padrao).
 */
export function competenciasDoDp(n: number, hoje = new Date()): { lista: string[]; padrao: string } {
  const base = competenciasDaTela(n);
  const atual = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  return { lista: hoje.getDate() >= 20 && !base.includes(atual) ? [atual, ...base] : base, padrao: base[0] };
}
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
  { id: 'senhas', rotulo: 'Senhas', icone: 'lock' },
  { id: 'historico', rotulo: 'Histórico', icone: 'clock' },
];

/** A lista do Cadastro (sem empresa) ou a janela de uma empresa, numa aba. */
export const caminhoDoCadastro = (rotaEmpresa: string | null, aba = 'bancos') =>
  BASE + '/cadastro/empresas' + (rotaEmpresa ? '/' + rotaEmpresa + '/' + aba : '');
export const caminhoDoExecutor = (rotaEmpresa: string, competencia: string) => BASE + '/executar/' + rotaEmpresa + '/' + competencia;
