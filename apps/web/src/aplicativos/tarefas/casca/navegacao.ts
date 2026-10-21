// Navegação da Tarefas: as aplicações ficam na gaveta ☰; a barra lateral mostra as páginas da
// aplicação aberta. Fiscal e Contábil aparecem para quem é do departamento (ou admin).
// URL: /tarefas/<aplicação>/<página>; a página de uma empresa é /tarefas/minhas-empresas/empresa/<empresa>;
// o executor das etapas é /tarefas/executar/<empresa>/<competência>.
// O Cadastro é a lista de empresas (/tarefas/cadastro/empresas); a empresa abre numa janela por cima da lista,
// com as abas dela: /tarefas/cadastro/empresas/<empresa>/<aba>.
import { tarefas as t, type uso } from '@nads/core';
import type { NomeIcone } from '@nads/ui';
import type { Operador } from './operador';

export const BASE = '/tarefas';

export type IdAplicacao = 'minhas-empresas' | 'contabil' | 'cadastro' | 'fiscal' | 'dp' | 'senhas' | 'drive' | 'contato' | 'mandei' | 'financeiro' | 'entregas' | 'area-cliente';

export interface Pagina {
  id: string; rotulo: string; icone: NomeIcone; titulo: string; /** a logo da marca no lugar do ícone, na lateral */ marca?: 'fgts';
  /** apagada na lateral; o clique avisa que está em desenvolvimento e não abre (Vitor, 21/10/2026) */
  emDesenvolvimento?: boolean;
}
export interface Aplicacao {
  id: IdAplicacao; nome: string; icone: NomeIcone; paginas: Pagina[]; pronta: boolean;
  /** o grupo na gaveta ☰ (14/10/2026: "melhore, atualize ícones") e a logo da marca no lugar do ícone (o Drive, o Gmail) */
  grupo: 'Rotinas' | 'Comunicação' | 'Escritório'; marca?: 'drive' | 'gmail';
}

export const APLICACOES: readonly Aplicacao[] = [
  { id: 'minhas-empresas', nome: 'Minhas empresas', icone: 'briefcase', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'list', titulo: 'Minhas empresas' },
    { id: 'insights', rotulo: 'Insights', icone: 'barChart', titulo: 'Insights', emDesenvolvimento: true },
  ] },
  { id: 'contabil', nome: 'Contábil', icone: 'scale', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Visão geral' },
    { id: 'paradas', rotulo: 'Paradas', icone: 'alert', titulo: 'Etapas paradas' },
    // os históricos do Creditor, os mesmos para todas as empresas (Vitor, 05/10/2026)
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Configurações' },
  ] },
  { id: 'cadastro', nome: 'Cadastro', icone: 'grade', grupo: 'Escritório', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase', titulo: 'Empresas' },
    // a organização nova (Vitor, 13/10/2026: "reveja a estrutura inteira do cadastro"): a Equipe (as pessoas e a proteção
    // do login) e os Robôs e agentes (a saúde dos robôs, o que eles fazem e os agentes do Claude, que antes ficavam em
    // Configurações e em Agentes; os links antigos levam para cá)
    { id: 'usuarios', rotulo: 'Equipe', icone: 'usuario', titulo: 'Equipe' },
    // "troca de robô para sistema" (13/10/2026)
    { id: 'sistema', rotulo: 'Sistema e agentes', icone: 'monitor', titulo: 'Sistema e agentes' },
    // o painel do robô (Vitor, 21/10/2026: "quero um painel para eu saber o que o robô está fazendo, arquivando e afins"):
    // os dois robôs (o do PC e o da nuvem), as filas, a atividade, o que foi arquivado e os erros; só o admin e o diretor
    { id: 'robo', rotulo: 'Painel do robô', icone: 'robo', titulo: 'Painel do robô' },
    // o mapa de uso (Gustavo, 20/10/2026: "um mapa quente que trackei o que tá sendo usado no sistema"): só o admin
    { id: 'uso', rotulo: 'Uso do sistema', icone: 'barChart', titulo: 'Uso do sistema' },
  ] },
  // o Fiscal no mesmo modelo do Contábil (Vitor, 05/10/2026): as empresas com a rotina do Fiscal, a visão e as paradas
  { id: 'fiscal', nome: 'Fiscal', icone: 'recibo', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'list', titulo: 'Empresas' },
    // o Painel (Vitor, 09/10/2026): todos os clientes do mês numa tela, com o que a rotina e o SIEG apontam
    { id: 'painel', rotulo: 'Painel', icone: 'painel', titulo: 'Painel' },
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Visão geral' },
    // a REINF (o fluxo do Notion do Heverton), logo abaixo da Visão geral
    { id: 'reinf', rotulo: 'REINF', icone: 'fileUp', titulo: 'REINF' },
    { id: 'paradas', rotulo: 'Paradas', icone: 'alert', titulo: 'Etapas paradas' },
    // o leitor do SINTEGRA (Vitor, 15/10/2026: "montar um leitor de sintegra")
    { id: 'sintegra', rotulo: 'SINTEGRA', icone: 'fileText', titulo: 'Leitor do SINTEGRA' },
    // a relação de faturamento dos clientes (Heverton, 20/10/2026; o usuário decidiu em 21/10: a receita de cada cliente)
    { id: 'faturamento', rotulo: 'Faturamento', icone: 'dinheiro', titulo: 'Faturamento dos clientes' },
  ] },
  // o DP (Vitor, 06/10/2026: o Checklist Folha "seria a rotina do dp"): as empresas com a rotina do DP, o painel da
  // planilha (números, gráficos, o progresso por responsável e as obrigações de cada cliente), a visão e as paradas
  { id: 'dp', nome: 'Departamento Pessoal', icone: 'usuario', grupo: 'Rotinas', pronta: true, paginas: [
    // tudo no tabelão (Vitor, 06/10/2026: "sem a parte de checklist"); as páginas na barra lateral ("eu ainda quero uma
    // barra lateral"); em Obrigações, uma tabela só, com as colunas agrupadas (Folha, eSocial, Guias, REINF, Entrega)
    { id: 'resumo', rotulo: 'Resumo', icone: 'painel', titulo: 'Resumo do mês' },
    { id: 'obrigacoes', rotulo: 'Obrigações', icone: 'checklist', titulo: 'Obrigações do mês' },
    { id: 'visao', rotulo: 'Visão geral', icone: 'barChart', titulo: 'Visão geral' },
    // a guia do FGTS Digital pelo robô da nuvem, com o certificado do escritório (Vitor, 07/10/2026)
    { id: 'fgts', rotulo: 'FGTS Digital', icone: 'fileDown', titulo: 'FGTS Digital', marca: 'fgts' },
    // os parâmetros de cada cliente (Vitor, 06/10/2026: "quero que o dp tenha a própria aba de configurações")
    // os textos de consulta que vieram do Toriba (Vitor, 14/10/2026: "importa as legislações em uma aba no DP")
    { id: 'legislacao', rotulo: 'Legislação', icone: 'scale', titulo: 'Legislação' },
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Configurações' },
  ] },
  // a entrega de documentos aos clientes, trazida do Entregas (16/10/2026: "quero integrar no app … o entregas"; "quero só a
  // parte de entregas"): a Rota (as paradas, Nova entrega, confirmar com a assinatura ou a foto) e o Painel do mês; todo o
  // escritório, como no Entregas (lá qualquer pessoa da equipe vê a Nova entrega, a Rota e o Painel)
  // 16/10/2026 ("só copia o entregas e joga aqui no design n1"): as três abas de lá, na mesma ordem (a Nova entrega primeiro)
  { id: 'entregas', nome: 'Entregas', icone: 'caminhao', grupo: 'Rotinas', pronta: true, paginas: [
    { id: 'nova', rotulo: 'Nova entrega', icone: 'lapis', titulo: 'Nova entrega' },
    { id: 'rota', rotulo: 'Rota', icone: 'caminhao', titulo: 'Rota' },
    { id: 'painel', rotulo: 'Painel', icone: 'painel', titulo: 'Painel do mês' },
    // as Solicitações (16/10/2026, "cadê as solicitações"): a aba do Entregas, logo depois do Painel como lá
    { id: 'solicitacoes', rotulo: 'Solicitações', icone: 'envelope', titulo: 'Solicitações' },
  ] },
  // as senhas gov.br e os certificados digitais, no cofre com a chave por pessoa (Vitor, 07/10/2026); todo o escritório
  { id: 'senhas', nome: 'Senhas', icone: 'lock', grupo: 'Escritório', pronta: true, paginas: [
    { id: 'empresas', rotulo: 'Empresas', icone: 'briefcase', titulo: 'Gov.br e certificados' },
    // o painel dos certificados: próximos a vencer, vencidos e válidos (07/10/2026)
    { id: 'certificados', rotulo: 'Certificados', icone: 'barChart', titulo: 'Certificados' },
    // as contas gov.br de pessoas (CPF), importadas da planilha (Vitor, 07/10/2026)
    { id: 'gov', rotulo: 'Contas gov.br', icone: 'usuario', titulo: 'Contas gov.br' },
    { id: 'acesso', rotulo: 'Acesso', icone: 'usuario', titulo: 'Acesso ao cofre' },
  ] },
  // o financeiro do escritório (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): as NFS-e de
  // honorários da Nilma (Taiobeiras, E&L), emitidas pelo robô da nuvem; só o admin e o diretor
  { id: 'financeiro', nome: 'Financeiro', icone: 'cartao', grupo: 'Escritório', pronta: true, paginas: [
    // o Movimento de Caixa e o Plano de Contas que vieram do Toriba (19/10/2026), no início do Financeiro
    { id: 'caixa', rotulo: 'Caixa', icone: 'dinheiro', titulo: 'Movimento de caixa' },
    // os honorários dos clientes, por competência (19/10/2026, fase 2 do Financeiro)
    { id: 'honorarios', rotulo: 'Honorários', icone: 'recibo', titulo: 'Honorários' },
    { id: 'plano', rotulo: 'Plano de contas', icone: 'list', titulo: 'Plano de contas' },
    { id: 'notas', rotulo: 'Notas fiscais', icone: 'recibo', titulo: 'Notas fiscais' },
    { id: 'configuracoes', rotulo: 'Configurações', icone: 'settings', titulo: 'Configurações do emissor' },
  ] },
  // a Área do Cliente (Vitor, 16/10/2026): o lado do escritório do site que o cliente abre pelo link secreto. Com o
  // Mandei junto (19/10/2026: "unifique área do cliente e o mandei"): o que o cliente manda (Chamados, Recebidos) e os
  // tickets que o escritório manda ao cliente (Meus tickets, a Central de todos); /tarefas/mandei/* leva para cá
  { id: 'area-cliente', nome: 'Área do Cliente', icone: 'usuario', grupo: 'Comunicação', pronta: true, paginas: [
    { id: 'chamados', rotulo: 'Chamados', icone: 'mensagem', titulo: 'Chamados' },
    { id: 'recebidos', rotulo: 'Recebidos', icone: 'download', titulo: 'Recebidos' },
    { id: 'meus', rotulo: 'Meus tickets', icone: 'usuario', titulo: 'Meus tickets' },
    { id: 'central', rotulo: 'Central de tickets', icone: 'list', titulo: 'Central de tickets' },
  ] },
  { id: 'drive', nome: 'Drive', icone: 'pasta', grupo: 'Comunicação', marca: 'drive', pronta: true, paginas: [
    { id: 'pastas', rotulo: 'Pastas', icone: 'pasta', titulo: 'Pasta do ano' },
  ] },
  { id: 'contato', nome: 'Gmail', icone: 'envelope', grupo: 'Comunicação', marca: 'gmail', pronta: true, paginas: [
    { id: 'caixa', rotulo: 'E-mails', icone: 'envelope', titulo: 'E-mails do robô' },
    { id: 'historico', rotulo: 'Histórico', icone: 'clock', titulo: 'Execuções do robô' },
  ] },
];

/**
 * Quem vê e mexe no cadastro das empresas: o admin, o diretor (Vitor, 05/10/2026) e o sênior (Vitor, 19/10/2026: "quero
 * que coloque uma opção onde os sênior possam ver e mexer no cadastro das empresas"). Excluir a empresa (só o admin, pelas
 * regras do banco) e o Link do cliente (useAcoesDoLink: o admin e o diretor) continuam de fora para o sênior.
 */
export const podeMexerNoCadastro = (op: Operador | null) => !!op && (op.admin || op.nivel === 'diretor' || op.nivel === 'senior');

/**
 * As páginas do Cadastro que o sênior não abre: Sistema e agentes (os robôs e os computadores) e o Painel do robô
 * (21/10/2026; as regras do banco só deixam o admin e o diretor lerem) não são cadastro de empresa.
 */
const SO_ADMIN_E_DIRETOR_NO_CADASTRO: readonly string[] = ['sistema', 'robo'];
/** As páginas do Cadastro só do admin: o Uso do sistema (21/10/2026; as regras do banco só deixam o admin ler uso/). */
const SO_ADMIN_NO_CADASTRO: readonly string[] = ['uso'];

/** As aplicações que a pessoa vê: Fiscal só para o Fiscal; Contábil e Drive só para o Contábil; Gmail para os dois (admin vê tudo). */
export function aplicacoesDe(op: Operador): Aplicacao[] {
  const soOSenior = !op.admin && op.nivel === 'senior';
  return APLICACOES.map(a => (a.id === 'cadastro' && !op.admin ? { ...a, paginas: a.paginas.filter(p => !SO_ADMIN_NO_CADASTRO.includes(p.id) && !(soOSenior && SO_ADMIN_E_DIRETOR_NO_CADASTRO.includes(p.id))) } : a)).filter(a =>
    (a.id !== 'fiscal' || op.admin || op.departamento === 'fiscal') &&
    (a.id !== 'dp' || op.admin || op.departamento === 'dp') &&
    (a.id !== 'contabil' || op.admin || op.departamento === 'contabil') &&
    // o Drive do robô: as regras do Entregas só deixam o admin e o contábil lerem; o Gmail (01/10/2026): o contábil
    // e o fiscal (cada um vê a caixa da Nilma e a do próprio setor)
    (a.id !== 'drive' || op.admin || op.departamento === 'contabil') &&
    (a.id !== 'contato' || op.admin || op.departamento === 'contabil' || op.departamento === 'fiscal') &&
    // o Cadastro (empresas, equipe e sistema): o admin e o diretor (Vitor, 05/10/2026); o sênior, menos o Sistema (19/10/2026)
    (a.id !== 'cadastro' || podeMexerNoCadastro(op)) &&
    // o Financeiro (as notas fiscais do escritório): o admin e o diretor (15/10/2026)
    (a.id !== 'financeiro' || op.admin || op.nivel === 'diretor'))
    // na gaveta, um grupo depois do outro: Rotinas, Comunicação, Escritório
    .sort((x, y) => ORDEM_DOS_GRUPOS.indexOf(x.grupo) - ORDEM_DOS_GRUPOS.indexOf(y.grupo));
}
const ORDEM_DOS_GRUPOS: readonly Aplicacao['grupo'][] = ['Rotinas', 'Comunicação', 'Escritório'];

/**
 * Todas as telas da navegação, para o Uso do sistema (as nunca visitadas): app/página e a aba da janela da empresa no
 * Cadastro (cadastro/empresas/<aba>), com o rótulo "Fiscal › Painel". A mesma chave de uso.telaDoCaminho.
 */
export function telasDaNavegacao(): uso.TelaDaNavegacao[] {
  const telas: uso.TelaDaNavegacao[] = [];
  for (const a of APLICACOES) {
    if (a.id === 'mandei') continue;
    for (const p of a.paginas) {
      if (p.emDesenvolvimento) continue;
      if (a.id === 'cadastro' && p.id === 'empresas') {
        telas.push({ tela: 'cadastro/empresas', rotulo: 'Cadastro › Empresas', app: a.id });
        for (const aba of ABAS_DO_CADASTRO) telas.push({ tela: 'cadastro/empresas/' + aba.id, rotulo: 'Cadastro › Empresa › ' + aba.grupo + ' › ' + aba.rotulo, app: a.id });
      } else telas.push({ tela: a.id + '/' + p.id, rotulo: a.nome + ' › ' + p.rotulo, app: a.id });
    }
  }
  return telas;
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
 * As competências do DP: as da tela e, à frente, o mês corrente e os dois seguintes (13/10/2026: "libere poder colocar
 * competências à frente", para lançar o que já se sabe e o 13º de novembro e dezembro; antes era só o mês corrente, do dia
 * 20 em diante). A que abre continua a de sempre (padrao).
 */
export function competenciasDoDp(n: number, hoje = new Date()): { lista: string[]; padrao: string } {
  const base = competenciasDaTela(n);
  const frente = [2, 1, 0].map(k => { const d = new Date(hoje.getFullYear(), hoje.getMonth() + k, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); });
  const lista = [...frente.filter(c => !base.includes(c)), ...base];
  // a que abre (21/10/2026: "na competência do DP tinha que setar o mês"): a última escolhida em qualquer página do DP nesta
  // aba do navegador; sem ela, a em trabalho (a do mês anterior até o 5º dia útil, depois a do mês atual)
  const escolhida = competenciaDoDpGuardada();
  const padrao = escolhida && lista.includes(escolhida) ? escolhida : t.competenciaDeTrabalhoDoDp(hoje);
  return { lista: lista.includes(padrao) ? lista : [padrao, ...lista], padrao };
}
const CHAVE_COMPETENCIA_DO_DP = 'nads-dp-competencia';
/** a competência escolhida no DP nesta aba (a mesma em todas as páginas do DP até trocar de novo) */
export function competenciaDoDpGuardada(): string {
  try { return sessionStorage.getItem(CHAVE_COMPETENCIA_DO_DP) || ''; } catch { return ''; }
}
export function guardarCompetenciaDoDp(c: string): void {
  try { if (/^\d{4}-\d{2}$/.test(c)) sessionStorage.setItem(CHAVE_COMPETENCIA_DO_DP, c); } catch { /* sem armazenamento: vale só a da página */ }
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
  // o Fiscal da empresa (Heverton, 20/10/2026: "Cadastro = Fiscal (inserir)"): os documentos e as planilhas no Drive, os
  // parcelamentos (os do Entregas) e o código de acesso do Simples (no cofre)
  { id: 'fiscal-docs', rotulo: 'Documentos e planilhas', icone: 'pasta', grupo: 'Fiscal' },
  { id: 'parcelamentos', rotulo: 'Parcelamentos', icone: 'dinheiro', grupo: 'Fiscal' },
  { id: 'simples', rotulo: 'Código do Simples', icone: 'lock', grupo: 'Fiscal' },
  { id: 'senhas', rotulo: 'Senhas', icone: 'lock', grupo: 'Acessos' },
  { id: 'historico', rotulo: 'Histórico', icone: 'clock', grupo: 'Registro' },
];

/** A lista do Cadastro (sem empresa) ou a janela de uma empresa, numa aba. */
export const caminhoDoCadastro = (rotaEmpresa: string | null, aba = 'empresa') =>
  BASE + '/cadastro/empresas' + (rotaEmpresa ? '/' + rotaEmpresa + '/' + aba : '');
export const caminhoDoExecutor = (rotaEmpresa: string, competencia: string) => BASE + '/executar/' + rotaEmpresa + '/' + competencia;

/**
 * O Importador LCDPR (o que era o lcdpr.html do Entregas), só nas empresas com ele (16/10/2026: "coloque o lcdpr como
 * parte da empresa 62 de carlos lucas apenas"; a lista é lcdpr.EMPRESAS_COM_LCDPR, no core). Depois, no mesmo dia ("ele só
 * precisa do lcdpr"), ele virou a rotina do Contábil dessas empresas: a etapa LCDPR do executor, com estas telas nas abas
 * de cima (executor/etapas/lcdpr). O endereço antigo da página da empresa (…/empresa/<código>/lcdpr/<página>) volta
 * para a página da empresa, que abre o executor.
 */
export const PAGINAS_DO_LCDPR: readonly Pagina[] = [
  { id: 'lancamentos', rotulo: 'Lançamentos', icone: 'dinheiro', titulo: 'Importar e conferir' },
  { id: 'categorias', rotulo: 'Categorias', icone: 'grade', titulo: 'Categorias' },
  { id: 'regras', rotulo: 'Regras de NCM', icone: 'hash', titulo: 'Regras de NCM' },
  { id: 'plano', rotulo: 'Plano de contas', icone: 'list', titulo: 'Plano de contas' },
  { id: 'tabelas', rotulo: 'Tabelas de apoio', icone: 'fileText', titulo: 'Tabelas de apoio' },
  { id: 'configuracao', rotulo: 'Configuração', icone: 'settings', titulo: 'Configuração geral' },
];
