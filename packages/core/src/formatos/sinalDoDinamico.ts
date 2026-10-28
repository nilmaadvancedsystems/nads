// O sinal do balancete dinâmico do Alterdata ("Saldo por mês") vem de dois jeitos (Vitor, 28/10/2026: "os fornecedores
// estão credores corretamente, corrija esse bug"):
//  - o de sempre: devedor positivo, credor negativo em todas as contas (o da 292);
//  - pela natureza: no Passivo (2…) e na Receita (4…) o credor vem positivo e o devedor negativo; no Ativo e na Despesa,
//    o devedor positivo (o da Brasão, 250). Aí o fornecedor credor (o certo) parecia devedor.
// O nads trabalha no de sempre: o dinâmico pela natureza tem o sinal do Passivo e da Receita trocado na leitura.

/** As contas que, no dinâmico pela natureza, vêm com o credor positivo: Passivo (2…) e Receita (4…). */
export const credoraPelaNatureza = (classificacao: string) => /^[24](\.|$)/.test(classificacao.trim());

/**
 * O dinâmico veio pela natureza? Pela Receita (4…), que é sempre credora: positiva = pela natureza. Sem Receita com saldo,
 * pelo Passivo (2…): a soma das contas de cima (as sem ponto ou, sem elas, todas) positiva = pela natureza.
 * `valores` = os saldos da linha (o anterior e os meses).
 */
export function dinamicoPelaNatureza(linhas: readonly { classificacao: string; valores: readonly number[] }[]): boolean {
  const soma = (ls: readonly { valores: readonly number[] }[]) => ls.reduce((t, l) => t + l.valores.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0), 0);
  const de = (g: string) => {
    const doGrupo = linhas.filter(l => l.classificacao.trim() === g || l.classificacao.trim().startsWith(g + '.'));
    const topo = doGrupo.filter(l => l.classificacao.trim() === g);
    return soma(topo.length ? topo : doGrupo.filter(l => l.classificacao.trim().split('.').length === 2));
  };
  const receita = de('4');
  if (Math.abs(receita) >= 0.005) return receita > 0;
  return de('2') > 0.005;
}
