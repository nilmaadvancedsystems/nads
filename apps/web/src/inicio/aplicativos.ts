// Os aplicativos do nads, na ordem da tela de início. Aplicativo novo = uma linha aqui
// + as rotas dele (aplicativos/<app>/rotas.tsx) somadas em apps/web/src/rotas.tsx.
import type { NomeIcone } from '@nads/ui';

export interface Aplicativo {
  id: string;
  nome: string;
  descricao: string;
  icone: NomeIcone;
  /** a escolha de empresa dele */
  rota: string;
}

export const APLICATIVOS: readonly Aplicativo[] = [
  { id: 'conferencia', nome: 'Conferência Contábil', descricao: 'Balancete × notas fiscais: relatório, checklist e verificação por conta.', icone: 'checklist', rota: '/conferencia' },
  { id: 'cheque-especial', nome: 'Cheque especial', descricao: 'Ajuste do saldo negativo da conta, a partir do saldo diário.', icone: 'landmark', rota: '/cheque-especial' },
  { id: 'conciliadorzinho', nome: 'Conciliadorzinho', descricao: 'Cartão × notas fiscais: arquivos por bandeira e das vendas sem cartão.', icone: 'cartao', rota: '/conciliadorzinho' },
];

/** Primeiro pedaço da URL que é de um aplicativo (o resto são links antigos da Conferência). */
export function ehRotaDeAplicativo(primeiroPedaco: string): boolean {
  return APLICATIVOS.some(a => a.rota === '/' + primeiroPedaco);
}
