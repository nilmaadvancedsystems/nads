// As ferramentas do Extratudo, na ordem da barra lateral. Todas trabalham com o banco da empresa:
// extrato, cheque especial e liquidação de títulos.
import type { NomeIcone } from '@nads/ui';
import type { IdFerramenta } from './casca/caminho';

export interface Ferramenta { id: IdFerramenta; nome: string; icone: NomeIcone }

export const FERRAMENTAS: readonly Ferramenta[] = [
  { id: 'extrator', nome: 'Extrator', icone: 'scale' },
  { id: 'cheque-especial', nome: 'Cheque especial', icone: 'landmark' },
  { id: 'creditor', nome: 'Creditor', icone: 'fileText' },
];
