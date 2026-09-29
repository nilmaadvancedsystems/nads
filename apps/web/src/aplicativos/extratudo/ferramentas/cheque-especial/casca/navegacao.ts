// Navegação do Cheque especial: uma seção (barra lateral) com uma página (aba do cabeçalho).
// O original é uma página só (cheque_especial.html, "Passo 1").
import type { NomeIcone } from '@nads/ui';

export interface Pagina { id: string; rotulo: string; icone: NomeIcone; titulo: string }
export interface Secao { id: string; rotulo: string; icone: NomeIcone; grupo: number; paginas: Pagina[] }

export const SECOES: Secao[] = [
  {
    id: 'ajuste', grupo: 1, rotulo: 'Ajuste', icone: 'landmark', paginas: [
      { id: 'ajuste/saldo-negativo', rotulo: 'Saldo negativo', icone: 'arrowDown', titulo: 'Ajuste de saldo negativo' },
    ],
  },
];

export const PAGINA_INICIAL = SECOES[0].paginas[0].id;

export function paginaPorId(id: string): Pagina | undefined {
  for (const s of SECOES) for (const p of s.paginas) if (p.id === id) return p;
  return undefined;
}
