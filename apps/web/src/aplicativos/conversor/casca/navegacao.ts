// Navegação do Conversor: três etapas (cada uma travada até a anterior estar pronta).
import { caminho } from './caminho';

export type IdEtapa = 'arquivo' | 'conferencia' | 'baixar';

export interface Etapa { id: IdEtapa; rotulo: string; titulo: string }

export const ETAPAS: Etapa[] = [
  { id: 'arquivo', rotulo: 'Arquivo', titulo: 'Extrato do banco' },
  { id: 'conferencia', rotulo: 'Conferência', titulo: 'Conferência dos lançamentos' },
  { id: 'baixar', rotulo: 'Baixar', titulo: 'Baixar o Excel' },
];

export const indiceDaEtapa = (id: string) => ETAPAS.findIndex(e => e.id === id);

export const caminhoDaEtapa = (e: IdEtapa) => caminho(e);
