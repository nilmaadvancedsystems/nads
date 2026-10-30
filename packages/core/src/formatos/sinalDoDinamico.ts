// O sinal do balancete dinâmico do Alterdata ("Saldo por mês") vem de dois jeitos (Vitor, 28/10/2026: "os fornecedores
// estão credores corretamente, corrija esse bug"):
//  - o de sempre: devedor positivo, credor negativo em todas as contas (o da 292);
//  - pela natureza: no Passivo (2…) e nas Receitas o credor vem positivo e o devedor negativo; no Ativo e nos Custos e
//    Despesas, o devedor positivo (o da Brasão, 250). Aí o fornecedor credor (o certo) parecia devedor.
// O nads trabalha no de sempre: o dinâmico pela natureza tem o sinal do Passivo e das Receitas trocado na leitura.
// No plano do Alterdata, 3 = Receitas e 4 = Custos e Despesas (30/10/2026: o 4 era tomado como Receita, e o dinâmico
// de sempre com despesa, o 4 positivo, virava "pela natureza" e trocava o sinal do Passivo e das despesas). O grupo das
// Receitas é o de cima (sem ponto) chamado "Receita(s)…"; sem ele, o 3.
import { normalizarTexto } from './index';

/** O grupo das Receitas no plano: a conta de cima (sem ponto) com o nome "Receita(s)…"; sem ela, o 3 do Alterdata. */
export function grupoDasReceitas(linhas: readonly { classificacao: string; descricao?: string }[]): string {
  const g = linhas.find(l => { const c = l.classificacao.trim(); return !!c && !c.includes('.') && /^receitas?\b/.test(normalizarTexto(l.descricao)); });
  return g ? g.classificacao.trim() : '3';
}

/** As contas que, no dinâmico pela natureza, vêm com o credor positivo: Passivo (2…) e Receitas (3…, ou o grupo delas). */
export function credoraPelaNatureza(classificacao: string, receitas = '3'): boolean {
  const c = classificacao.trim();
  return ['2', receitas].some(g => c === g || c.startsWith(g + '.'));
}

/**
 * O dinâmico veio pela natureza? Pelas Receitas (3…), que são sempre credoras: positivas = pela natureza. Sem Receita com
 * saldo, pelo Passivo (2…): a soma das contas de cima (as sem ponto ou, sem elas, todas) positiva = pela natureza. Os
 * Custos e Despesas (4…) não dizem nada: são devedores (positivos) nos dois jeitos.
 * `valores` = os saldos da linha (o anterior e os meses); `descricao` acha o grupo das Receitas (grupoDasReceitas).
 */
export function dinamicoPelaNatureza(linhas: readonly { classificacao: string; descricao?: string; valores: readonly number[] }[]): boolean {
  const soma = (ls: readonly { valores: readonly number[] }[]) => ls.reduce((t, l) => t + l.valores.reduce((a, v) => a + (Number.isFinite(v) ? v : 0), 0), 0);
  const de = (g: string) => {
    const doGrupo = linhas.filter(l => l.classificacao.trim() === g || l.classificacao.trim().startsWith(g + '.'));
    const topo = doGrupo.filter(l => l.classificacao.trim() === g);
    return soma(topo.length ? topo : doGrupo.filter(l => l.classificacao.trim().split('.').length === 2));
  };
  const receita = de(grupoDasReceitas(linhas));
  if (Math.abs(receita) >= 0.005) return receita > 0;
  return de('2') > 0.005;
}
