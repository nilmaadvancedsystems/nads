// O que a Conferência já tem importado de uma empresa (Balancete, Entradas, Saídas, Tomados, Prestados), para a
// etapa de Importação da Tarefas saber se pode seguir. Lê o mesmo repositório da Conferência que as abas da etapa
// usam (um só, sem abrir outra conexão) e redesenha quando ele muda. null = ainda carregando.
import { conferencia as c, demo, formatos } from '@nads/core';
import { modoDesenvolvedor } from '../../comum/modoDesenvolvedor';
import { useSyncExternalStore } from 'react';
import { repoDaConferencia } from './dados/fonte';

export function useImportadosDaConferencia(nome: string): c.JaImportado | null {
  const repo = repoDaConferencia();
  useSyncExternalStore(repo.assinar, repo.versao, repo.versao);
  if (!repo.pronto()) return null;
  const achada = repo.empresaPelaRota(formatos.slug(nome));
  const e = repo.obter(achada?.nome || nome);
  return e ? c.jaImportado(e) : { balancete: false, entradas: false, saidas: false, tomados: false, prestados: false };
}

/** As contas do balancete importado na Conferência (a etapa Contabilização da Folha monta o checklist com elas). null = carregando. */
const semAssinar = () => () => {};
const versaoZero = () => 0;

export function useContasDoBalancete(nome: string): c.Conta[] | null {
  // sem nome (a etapa não é a da folha): nem liga a Conferência
  const repo = nome ? repoDaConferencia() : null;
  useSyncExternalStore(repo ? repo.assinar : semAssinar, repo ? repo.versao : versaoZero, repo ? repo.versao : versaoZero);
  if (!repo || !repo.pronto()) return null;
  const achada = repo.empresaPelaRota(formatos.slug(nome));
  return repo.obter(achada?.nome || nome)?.contas || [];
}

/**
 * As notas de Saída importadas na Conferência (a Importação da Tarefa): o Creditor acha a conta de cada título pela NF
 * delas (Vitor, 05/10/2026). Só lê. null = carregando; sem nome, nem liga a Conferência.
 */
export function useSaidasDaConferencia(nome: string): c.Nota[] | null {
  const repo = nome ? repoDaConferencia() : null;
  useSyncExternalStore(repo ? repo.assinar : semAssinar, repo ? repo.versao : versaoZero, repo ? repo.versao : versaoZero);
  if (!repo || !repo.pronto()) return null;
  const achada = repo.empresaPelaRota(formatos.slug(nome));
  return repo.obter(achada?.nome || nome)?.saidas || [];
}

/**
 * As notas importadas na Conferência (Entradas, Saídas, Tomados, Prestados), para o painel das tarefas do Fiscal (a
 * "checklist disfarçada", Vitor 06/10/2026). Só lê. null = carregando; sem nome, nem liga a Conferência.
 */
export function useNotasDaConferencia(nome: string): { entradas: c.Nota[]; saidas: c.Nota[]; tomados: c.NotaServico[]; prestados: c.NotaServico[] } | null {
  const repo = nome ? repoDaConferencia() : null;
  useSyncExternalStore(repo ? repo.assinar : semAssinar, repo ? repo.versao : versaoZero, repo ? repo.versao : versaoZero);
  if (!repo || !repo.pronto()) return null;
  const achada = repo.empresaPelaRota(formatos.slug(nome));
  const e = repo.obter(achada?.nome || nome);
  return { entradas: e?.entradas || [], saidas: e?.saidas || [], tomados: e?.servTomados || [], prestados: e?.servPrestados || [] };
}

/**
 * O ⚡ do Fiscal (Vitor, 06/10/2026): põe (ou tira) as notas de teste do Fiscal na Conferência da empresa — Entradas,
 * Saídas, Tomados e Prestados dos meses. Só no modo desenvolvedor (a gravação finge que gravou: fica só nesta tela) ou na
 * empresa de teste (fica neste navegador); fora disso, não faz nada e devolve false.
 */
export function implantarNotasFiscaisDeTeste(nome: string, meses: readonly string[], tipo: string): boolean {
  if (!modoDesenvolvedor() && !demo.ehEmpresaDemo(nome)) return false;
  const repo = repoDaConferencia();
  if (!repo.pronto() || !meses.length) return false;
  const achada = repo.empresaPelaRota(formatos.slug(nome));
  const nomeReal = achada?.nome || nome;
  const e = repo.obter(nomeReal) || c.empresaNova(nomeReal);
  if (tipo === 'apagar-fiscal') repo.salvar(demo.semNotasFiscaisDeTeste(e));
  else if (tipo === 'completo' || tipo === 'mercadorias') repo.salvar(demo.comNotasFiscaisDeTeste(e, meses, tipo));
  else return false;
  return true;
}
