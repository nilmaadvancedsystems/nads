// Navegação do Cheque especial: é uma seção da barra lateral do Concilia aí, e as páginas dele são
// as abas do cabeçalho (/<empresa>/cheque-especial/<página>).
// O original é uma página só (cheque_especial.html, "Passo 1").
import type { NomeIcone } from '@nads/ui';
import { caminho } from '../../../casca/caminho';

export interface Pagina { id: string; rotulo: string; icone: NomeIcone; titulo: string }

export const PAGINAS: Pagina[] = [
  { id: 'saldo-negativo', rotulo: 'Saldo negativo', icone: 'arrowDown', titulo: 'Ajuste de saldo negativo' },
];

export const PAGINA_INICIAL = PAGINAS[0].id;

export function paginaPorId(id: string): Pagina | undefined {
  return PAGINAS.find(p => p.id === id);
}

/** Caminho completo de uma página, na empresa aberta. */
export const caminhoDaPagina = (rota: string, pagina: string) => caminho(rota + '/cheque-especial/' + pagina);
