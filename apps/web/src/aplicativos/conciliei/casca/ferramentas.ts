// As ferramentas do Conciliei, na ordem da caixa à esquerda. Nenhuma guarda nada: cada uma recebe
// arquivos, devolve no máximo um resultado, e sair da empresa (ou trocar de ferramenta) começa do zero.
// Ferramenta nova = uma linha aqui + a pasta dela em ferramentas/<id>/ + a entrada em EmpresaAberta.
import type { NomeIcone } from '@nads/ui';

export type IdFerramenta = 'conciliadorzinho' | 'cheque-especial';

export interface Ferramenta {
  id: IdFerramenta;
  nome: string;
  icone: NomeIcone;
  /** a página em que ela abre (o resto da URL depois da ferramenta) */
  inicial: string;
}

export const FERRAMENTAS: readonly Ferramenta[] = [
  { id: 'conciliadorzinho', nome: 'Conciliadorzinho', icone: 'cartao', inicial: 'conciliacao/bandeiras' },
  { id: 'cheque-especial', nome: 'Cheque especial', icone: 'landmark', inicial: 'ajuste/saldo-negativo' },
];

export function ferramentaPorId(id: string): Ferramenta | undefined {
  return FERRAMENTAS.find(f => f.id === id);
}
