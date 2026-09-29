// Navegação do Creditor: as etapas do fluxo, na barra lateral (travadas até serem liberadas).
// URL: /creditor/<código da empresa>/<etapa>.
import type { NomeIcone } from '@nads/ui';
import { caminho } from './caminho';

export type IdEtapa = 'competencia' | 'banco' | 'conferencia' | 'fiscal' | 'sistema' | 'cruzamento' | 'lancamentos';

export interface Etapa { id: IdEtapa; rotulo: string; titulo: string; icone: NomeIcone }

export const ETAPAS: Etapa[] = [
  { id: 'competencia', rotulo: 'Competência', titulo: 'Competência', icone: 'calendar' },
  { id: 'banco', rotulo: 'Relatório do banco', titulo: 'Relatório de liquidação do banco', icone: 'landmark' },
  { id: 'conferencia', rotulo: 'Conferência', titulo: 'Conferência dos grupos', icone: 'scale' },
  { id: 'fiscal', rotulo: 'Fiscal', titulo: 'Baixa no Fiscal', icone: 'checklist' },
  { id: 'sistema', rotulo: 'Sistema', titulo: 'Arquivo do sistema', icone: 'fileText' },
  { id: 'cruzamento', rotulo: 'Cruzamento', titulo: 'Cruzamento banco × sistema', icone: 'repeat' },
  { id: 'lancamentos', rotulo: 'Lançamentos', titulo: 'Lançamentos para importar', icone: 'download' },
];

export const indiceDaEtapa = (id: string) => ETAPAS.findIndex(e => e.id === id);

/** Caminho completo de uma etapa, na empresa aberta. */
export const caminhoDaEtapa = (rota: string, e: IdEtapa) => caminho(rota + '/' + e);
