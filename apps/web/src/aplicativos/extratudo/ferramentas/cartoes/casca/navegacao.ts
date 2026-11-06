// Navegação do Cartões (Vitor, 07/10/2026): o cartão de crédito empresarial (a fatura quebrada no razão do cartão).
// As vendas no cartão (a cópia do Conciliadorzinho) entram como outra página quando forem feitas.
import type { NomeIcone } from '@nads/ui';

export interface Pagina { id: string; rotulo: string; icone: NomeIcone; titulo: string }

export const PAGINAS: Pagina[] = [
  { id: 'compras/fatura', rotulo: 'Cartão empresarial', icone: 'cartao', titulo: 'Fatura do cartão empresarial' },
];

export const PAGINA_INICIAL = PAGINAS[0].id;

export function paginaPorId(id: string): Pagina | undefined {
  return PAGINAS.find(p => p.id === id);
}
