// A conta de cada título pelo relatório de Saídas que a pessoa importou na Importação da Tarefa (Vitor, 05/10/2026:
// "essas contas para decidir, puxe o relatório de saídas… lá tem a coluna da nota fiscal e a coluna de conta
// contábil"). A NF do título ("9857/3/3") acha a nota ("009857") pela chave da NF; a conta da nota é a do cliente.
// O nome do banco pode ser outro (o nome da loja; na NF, a razão social da filial): a NF decide; o nome só desempata.
import { chaveNf } from './numeros';

/** A conta (e o nome do cliente) que o relatório de Saídas traz para uma NF. */
export interface ContaDaNota { conta: string; nome: string }

/** NF → as contas (sem repetir) das notas com essa NF que trazem a conta. */
export function contasPorNf(notas: readonly { numero: string; nome: string; conta?: string }[]): Map<string, ContaDaNota[]> {
  const m = new Map<string, ContaDaNota[]>();
  for (const n of notas) {
    const conta = (n.conta || '').trim();
    const nf = chaveNf(n.numero);
    if (!conta || !nf) continue;
    const lista = m.get(nf) || [];
    if (!lista.some(x => x.conta === conta)) m.set(nf, [...lista, { conta, nome: n.nome }]);
  }
  return m;
}
