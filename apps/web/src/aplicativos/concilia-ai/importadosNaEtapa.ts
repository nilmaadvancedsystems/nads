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
