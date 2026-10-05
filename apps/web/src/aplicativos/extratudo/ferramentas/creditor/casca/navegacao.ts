// Navegação do Creditor: as etapas do fluxo, na barra lateral (travadas até serem liberadas).
// URL: /creditor/<código da empresa>/<etapa>.
import type { NomeIcone } from '@nads/ui';
import { caminho } from './caminho';

// Sem Conferência dos grupos e sem arquivo do sistema (2026-09-29): a conta de cada cliente vem do balancete.
export type IdEtapa = 'competencia' | 'fiscal' | 'cruzamento' | 'lancamentos';

export interface Etapa { id: IdEtapa; rotulo: string; titulo: string; icone: NomeIcone }

export const ETAPAS: Etapa[] = [
  { id: 'competencia', rotulo: 'Competência', titulo: 'Competência', icone: 'calendar' },
  { id: 'fiscal', rotulo: 'Fiscal', titulo: 'Baixa no Fiscal', icone: 'checklist' },
  { id: 'cruzamento', rotulo: 'Contas', titulo: 'Conta de cada cliente', icone: 'repeat' },
  { id: 'lancamentos', rotulo: 'Lançamentos', titulo: 'Lançamentos para importar', icone: 'download' },
];

export const indiceDaEtapa = (id: string) => ETAPAS.findIndex(e => e.id === id);

/** Caminho completo de uma etapa, na empresa aberta. */
export const caminhoDaEtapa = (rota: string, e: IdEtapa) => caminho(rota + '/' + e);
