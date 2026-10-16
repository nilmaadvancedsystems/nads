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

export type IdAplicacao = 'minhas-empresas' | 'contabil' | 'cadastro' | 'fiscal' | 'dp' | 'senhas' | 'drive' | 'contato' | 'mandei' | 'financeiro' | 'entregas';

export interface Pagina { id: string; rotulo: string; icone: NomeIcone; titulo: string }
export interface Aplicacao {
  id: IdAplicacao; nome: string; icone: NomeIcone; paginas: Pagina[]; pronta: boolean;
  /** o grupo na gaveta ☰ (14/10/2026: "melhore, atualize ícones") e a logo da marca no lugar do ícone (o Drive, o Gmail) */
  grupo: 'Rotinas' | 'Comunicação' | 'Escritório'; marca?: 'drive' | 'gmail';
}

export const APLICACOES: readonly Aplicacao[] = [
  { id: 'minhas-empresas', nome: 'Minhas empresas', icone: 'briefcase', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'list', titulo: 'Minhas empresas' },
    { id: 'insights', rotulo: 'Insights', icone: 'barChart', titulo: 'Minhas empresas — insights' },
  ] },
  { id: 'contabil', nome: 'Contábil', icone: 'scale', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Contábil — visão geral' },
    { id: 'paradas', rotulo: 'Paradas', icone: 'alert', titulo: 'Contábil — etapas paradas' },
    // os históricos do Creditor, os mesmos para todas as empresas (Vitor, 05/10/2026)
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Contábil — configurações' },
  ] },
  { id: 'cadastro', nome: 'Cadastro', icone: 'grade', grupo: 'Escritório', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase', titulo: 'Cadastro — empresas' },
    // a organização nova (Vitor, 13/10/2026: "reveja a estrutura inteira do cadastro"): a Equipe (as pessoas e a proteção
    // do login) e os Robôs e agentes (a saúde dos robôs, o que eles fazem e os agentes do Claude, que antes ficavam em
    // Configurações e em Agentes; os links antigos levam para cá)
    { id: 'usuarios', rotulo: 'Equipe', icone: 'usuario', titulo: 'Cadastro — equipe' },
    // "troca de robô para sistema" (13/10/2026)
    { id: 'sistema', rotulo: 'Sistema e agentes', icone: 'monitor', titulo: 'Cadastro — sistema e agentes' },
  ] },
  // o Fiscal no mesmo modelo do Contábil (Vitor, 05/10/2026): as empresas com a rotina do Fiscal, a visão e as paradas
  { id: 'fiscal', nome: 'Fiscal', icone: 'recibo', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'list', titulo: 'Fiscal — empresas' },
    // o Painel (Vitor, 09/10/2026): todos os clientes do mês numa tela, com o que a rotina e o SIEG apontam
    { id: 'painel', rotulo: 'Painel', icone: 'painel', titulo: 'Fiscal — painel' },
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Fiscal — visão geral' },
    // a REINF (o fluxo do Notion do Heverton), logo abaixo da Visão geral
    { id: 'reinf', rotulo: 'REINF', icone: 'fileUp', titulo: 'Fiscal — REINF' },
    { id: 'paradas', rotulo: 'Paradas', icone: 'alert', titulo: 'Fiscal — etapas paradas' },
    // o leitor do SINTEGRA (Vitor, 15/10/2026: "montar um leitor de sintegra")
    { id: 'sintegra', rotulo: 'SINTEGRA', icone: 'fileText', titulo: 'Fiscal — leitor do SINTEGRA' },
  ] },
  // o DP (Vitor, 06/10/2026: o Checklist Folha "seria a rotina do dp"): as empresas com a rotina do DP, o painel da
  // planilha (números, gráficos, o progresso por responsável e as obrigações de cada cliente), a visão e as paradas
  { id: 'dp', nome: 'Departamento Pessoal', icone: 'usuario', grupo: 'Rotinas', pronta: true, paginas: [
    // tudo no tabelão (Vitor, 06/10/2026: "sem a parte de checklist"); as páginas na barra lateral ("eu ainda quero uma
    // barra lateral"); em Obrigações, uma tabela só, com as colunas agrupadas (Folha, eSocial, Guias, REINF, Entrega)
    { id: 'resumo', rotulo: 'Resumo', icone: 'painel', titulo: 'DP — resumo do mês' },
    { id: 'obrigacoes', rotulo: 'Obrigações', icone: 'checklist', titulo: 'DP — obrigações do mês' },
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'DP — visão geral' },
    // a guia do FGTS Digital pelo robô da nuvem, com o certificado do escritório (Vitor, 07/10/2026)
    { id: 'fgts', rotulo: 'FGTS Digital', icone: 'fileDown', titulo: 'DP — guias do FGTS Digital' },
    // os parâmetros de cada cliente (Vitor, 06/10/2026: "quero que o dp tenha a própria aba de configurações")
    // os textos de consulta que vieram do Toriba (Vitor, 14/10/2026: "importa as legislações em uma aba no DP")
    { id: 'legislacao', rotulo: 'Legislação', icone: 'scale', titulo: 'DP — legislação' },
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'DP — configurações' },
  ] },
  // a entrega de documentos aos clientes, trazida do Entregas (16/10/2026: "quero integrar no app … o entregas"; "quero só a
  // parte de entregas"): a Rota (as paradas, Nova entrega, confirmar com a assinatura ou a foto) e o Painel do mês; todo o
  // escritório, como no Entregas (lá qualquer pessoa da equipe vê a Nova entrega, a Rota e o Painel)
  { id: 'entregas', nome: 'Entregas', icone: 'caminhao', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'rota', rotulo: 'Rota', icone: 'caminhao', titulo: 'Entregas — rota' },
    { id: 'painel', rotulo: 'Painel', icone: 'painel', titulo: 'Entregas — painel do mês' },
  ] },
  // as senhas gov.br e os certificados digitais, no cofre com a chave por pessoa (Vitor, 07/10/2026); todo o escritório
  { id: 'senhas', nome: 'Senhas', icone: 'lock', grupo: 'Escritório', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase', titulo: 'Senhas — gov.br e certificados' },
    // o painel dos certificados: próximos a vencer, vencidos e válidos (07/10/2026)
    { id: 'certificados', rotulo: 'Certificados', icone: 'barChart', titulo: 'Senhas — certificados' },
    // as contas gov.br de pessoas (CPF), importadas da planilha (Vitor, 07/10/2026)
    { id: 'gov', rotulo: 'Contas gov.br', icone: 'usuario', titulo: 'Senhas — contas gov.br' },
    { id: 'acesso', rotulo: 'Acesso', icone: 'usuario', titulo: 'Senhas — acesso ao cofre' },
  ] },
  // o financeiro do escritório (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): as NFS-e de
  // honorários da Nilma (Taiobeiras, E&L), emitidas pelo robô da nuvem; só o admin e o diretor
  { id: 'financeiro', nome: 'Financeiro', icone: 'cartao', grupo: 'Escritório', pronta: true, paginas: [
    { id: 'notas', rotulo: 'Notas fiscais', icone: 'recibo', titulo: 'Financeiro — notas fiscais' },
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Financeiro — configurações do emissor' },
  ] },
  // os tickets mandados aos clientes (Vitor, 07/10/2026): os meus e a central de todos
  { id: 'mandei', nome: 'Mandei', icone: 'mensagem', grupo: 'Comunicação', pronta: true, paginas: [
    { id: 'meus', rotulo: 'Meus tickets', icone: 'usuario', titulo: 'Mandei — meus tickets' },
    { id: 'central', rotulo: 'Central', icone: 'list', titulo: 'Mandei — central de tickets' },
  ] },
  { id: 'drive', nome: 'Drive', icone: 'pasta', grupo: 'Comunicação', marca: 'drive', pronta: true, paginas: [
    { id: 'pastas', rotulo: 'Pastas', icone: 'pasta', titulo: 'Drive — pasta do ano' },
  ] },
  { id: 'contato', nome: 'Gmail', icone: 'envelope', grupo: 'Comunicação', marca: 'gmail', pronta: true, paginas: [
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
    (a.id !== 'cadastro' || op.admin || op.nivel === 'diretor') &&
    // o Financeiro (as notas fiscais do escritório): o admin e o diretor (15/10/2026)
    (a.id !== 'financeiro' || op.admin || op.nivel === 'diretor'))
    // na gaveta, um grupo depois do outro: Rotinas, Comunicação, Escritório
    .sort((x, y) => ORDEM_DOS_GRUPOS.indexOf(x.grupo) - ORDEM_DOS_GRUPOS.indexOf(y.grupo));
}
const ORDEM_DOS_GRUPOS: readonly Aplicacao['grupo'][] = ['Rotinas', 'Comunicação', 'Escritório'];

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
 * As competências do DP: as da tela e, à frente, o mês corrente e os dois seguintes (13/10/2026: "libere poder colocar
 * competências à frente", para lançar o que já se sabe e o 13º de novembro e dezembro; antes era só o mês corrente, do dia
 * 20 em diante). A que abre continua a de sempre (padrao).
 */
export function competenciasDoDp(n: number, hoje = new Date()): { lista: string[]; padrao: string } {
  const base = competenciasDaTela(n);
  const frente = [2, 1, 0].map(k => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
  return { lista: [...frente.filter(c => !base.includes(c)), ...base], padrao: base[0] };
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
// em grupos (13/10/2026: "reveja a estrutura inteira do cadastro"): a janela abre na Empresa (o resumo do que falta)
// por setor, no estilo das configurações do Notion (14/10/2026: "contas padrão e bancárias irão ficar em contábil")
export const ABAS_DO_CADASTRO: readonly { id: string; rotulo: string; icone: NomeIcone; grupo: string }[] = [
  { id: 'empresa', rotulo: 'Dados da empresa', icone: 'briefcase', grupo: 'Empresa' },
  { id: 'contabil', rotulo: 'Parâmetros', icone: 'settings', grupo: 'Contábil' },
  { id: 'bancos', rotulo: 'Contas bancárias', icone: 'landmark', grupo: 'Contábil' },
  { id: 'plano', rotulo: 'Plano de contas', icone: 'list', grupo: 'Contábil' },
  { id: 'contas-padrao', rotulo: 'Contas padrão', icone: 'hash', grupo: 'Contábil' },
  { id: 'fiscal', rotulo: 'Parâmetros', icone: 'scale', grupo: 'Fiscal' },
  { id: 'senhas', rotulo: 'Senhas', icone: 'lock', grupo: 'Acessos' },
  { id: 'historico', rotulo: 'Histórico', icone: 'clock', grupo: 'Registro' },
];

/** A lista do Cadastro (sem empresa) ou a janela de uma empresa, numa aba. */
export const caminhoDoCadastro = (rotaEmpresa: string | null, aba = 'empresa') =>
  BASE + '/cadastro/empresas' + (rotaEmpresa ? '/' + rotaEmpresa + '/' + aba : '');
export const caminhoDoExecutor = (rotaEmpresa: string, competencia: string) => BASE + '/executar/' + rotaEmpresa + '/' + competencia;

/**
 * O Importador LCDPR (o que era o lcdpr.html do Entregas) como parte da página da empresa (16/10/2026: "coloque o lcdpr
 * como parte da empresa 62 de carlos lucas apenas"): só nas empresas desta lista; as telas dele entram na barra lateral,
 * embaixo das páginas da aplicação. /tarefas/minhas-empresas/empresa/<código>/lcdpr/<página>
 */
export const EMPRESAS_COM_LCDPR: readonly number[] = [62];
export const temLcdpr = (codigo: number | null | undefined) => codigo != null && EMPRESAS_COM_LCDPR.includes(codigo);
export const PAGINAS_DO_LCDPR: readonly Pagina[] = [
  { id: 'lancamentos', rotulo: 'Lançamentos', icone: 'dinheiro', titulo: 'LCDPR — importar e conferir' },
  { id: 'categorias', rotulo: 'Categorias', icone: 'grade', titulo: 'LCDPR — categorias' },
  { id: 'regras', rotulo: 'Regras de NCM', icone: 'hash', titulo: 'LCDPR — regras de NCM' },
  { id: 'plano', rotulo: 'Plano de contas', icone: 'list', titulo: 'LCDPR — plano de contas' },
  { id: 'tabelas', rotulo: 'Tabelas de apoio', icone: 'fileText', titulo: 'LCDPR — tabelas de apoio' },
  { id: 'configuracao', rotulo: 'Configuração', icone: 'settings', titulo: 'LCDPR — configuração geral' },
];
export const caminhoDoLcdpr = (rotaEmpresa: string, pagina: string) => BASE + '/minhas-empresas/empresa/' + rotaEmpresa + '/lcdpr/' + pagina;
