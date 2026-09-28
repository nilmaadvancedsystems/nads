// Navegação do Creditor: é uma seção da barra lateral do Concilia aí, e cada etapa do fluxo é uma
// aba do cabeçalho (/<empresa>/creditor/<etapa>).
import type { NomeIcone } from '@nads/ui';
import { caminho } from '../../../casca/caminho';

export type IdEtapa = 'banco' | 'conferencia' | 'sistema' | 'cruzamento' | 'lancamentos';

export interface Etapa { id: IdEtapa; rotulo: string; titulo: string; icone: NomeIcone }

export const ETAPAS: Etapa[] = [
  { id: 'banco', rotulo: 'Relatório do banco', titulo: 'Relatório de liquidação do banco', icone: 'landmark' },
  { id: 'conferencia', rotulo: 'Conferência', titulo: 'Conferência dos grupos', icone: 'scale' },
  { id: 'sistema', rotulo: 'Sistema', titulo: 'Arquivo do sistema', icone: 'fileText' },
  { id: 'cruzamento', rotulo: 'Cruzamento', titulo: 'Cruzamento banco × sistema', icone: 'repeat' },
  { id: 'lancamentos', rotulo: 'Lançamentos', titulo: 'Lançamentos para importar', icone: 'download' },
];

export const indiceDaEtapa = (id: string) => ETAPAS.findIndex(e => e.id === id);

/** Caminho completo de uma etapa, na empresa aberta. */
export const caminhoDaEtapa = (rota: string, e: IdEtapa) => caminho(rota + '/creditor/' + e);
