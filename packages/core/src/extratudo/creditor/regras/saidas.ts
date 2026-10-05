// A conta de cada título pelo relatório de Saídas que a pessoa importou na Importação da Tarefa (Vitor, 05/10/2026:
// "essas contas para decidir, puxe o relatório de saídas… lá tem a coluna da nota fiscal e a coluna de conta
// contábil"). A NF do título ("9857/3/3") acha a nota ("009857") pela chave da NF; a conta da nota é a do cliente.
import { chaveNf } from './numeros';

/** A conta (e o nome do cliente) que o relatório de Saídas traz para uma NF. */
export interface ContaDaNota { conta: string; nome: string }

/**
 * NF → conta, das notas que têm a conta. A mesma NF com contas diferentes (relatórios de anos diferentes, notas
 * de séries diferentes) não decide: fica de fora, e o título segue pelo balancete.
 */
export function contasPorNf(notas: readonly { numero: string; nome: string; conta?: string }[]): Map<string, ContaDaNota> {
  const m = new Map<string, ContaDaNota>();
  const conflito = new Set<string>();
  for (const n of notas) {
    const conta = (n.conta || '').trim();
    const nf = chaveNf(n.numero);
    if (!conta || !nf || conflito.has(nf)) continue;
    const ja = m.get(nf);
    if (ja && ja.conta !== conta) { m.delete(nf); conflito.add(nf); continue; }
    if (!ja) m.set(nf, { conta, nome: n.nome });
  }
  return m;
}
