// O que a Conferência já tem importado de uma empresa (Balancete, Entradas, Saídas, Tomados, Prestados), para a
// etapa de Importação da Tarefas saber se pode seguir. Lê o mesmo repositório da Conferência que as abas da etapa
// usam (um só, sem abrir outra conexão) e redesenha quando ele muda. null = ainda carregando.
import { conferencia as c, formatos } from '@nads/core';
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
