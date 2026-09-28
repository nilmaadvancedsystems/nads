// Conferência final antes de liberar os arquivos, e os totais por mês da tela "Totais".
// Origem: conciliadorZINHO.html validateTotals (~L1640) e renderTotalsBreakdown (~L1673, só as contas).
import { bandeira } from '../tabelas/bandeiras';
import type { Conciliacao, IdBandeira, Mes, ResultadoBandeira, TotalDoMes, Transacao, Venda } from '../tipos';
import { brl, rotuloMes } from './formatos';
import { chaveMes, chaveMesDaData } from './meses';

/** Tolerância da conferência (2 centavos). */
export const TOLERANCIA = 0.02;

const VAZIO: ResultadoBandeira = { meses: [], aprovadas: 0, casadas: 0, semNota: 0, totalBruto: 0, totalTaxa: 0, linhas: [] };
const doResultado = (c: Conciliacao, id: IdBandeira): ResultadoBandeira => c.porBandeira[id] ?? VAZIO;
const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * (1) bruto e taxa do arquivo de cada bandeira têm de bater com o extrato INTEIRO dela;
 * (2) toda venda da planilha tem de aparecer uma vez: casada numa bandeira ou nas Saídas.
 * Mesmas mensagens do original (validateTotals). Atenção, como no original: o extrato inteiro
 * inclui os meses que o filtro de mesesPermitidos tirou, então com filtro ativo e lançamentos
 * fora dos meses em comum a conferência (1) acusa diferença.
 */
export function conferirTotais(c: Conciliacao, ordem: IdBandeira[], transacoes: Partial<Record<IdBandeira, Transacao[]>>, vendas: Venda[]): { ok: boolean; problemas: string[] } {
  const problemas: string[] = [];

  for (const id of ordem) {
    const r = doResultado(c, id);
    const originais = transacoes[id] ?? [];
    const brutoOrig = arred(originais.reduce((s, t) => s + t.bruto, 0));
    const taxaOrig = arred(originais.reduce((s, t) => s + t.taxa, 0));
    const rotulo = bandeira(id).rotulo;
    if (Math.abs(r.totalBruto - brutoOrig) > TOLERANCIA)
      problemas.push(rotulo + ': total de vendas brutas do arquivo final (' + brl(r.totalBruto) + ') não bate com o extrato original (' + brl(brutoOrig) + ').');
    if (Math.abs(r.totalTaxa - taxaOrig) > TOLERANCIA)
      problemas.push(rotulo + ': total de taxas do arquivo final (' + brl(r.totalTaxa) + ') não bate com o extrato original (' + brl(taxaOrig) + ').');
  }

  const totalPlanilha = arred(vendas.reduce((s, v) => s + v.bruto, 0));
  let casadasNasBandeiras = 0;
  for (const id of ordem) {
    for (const l of doResultado(c, id).linhas) if (l.tipo === 'Bruto' && l.casou) casadasNasBandeiras += l.valor;
  }
  const totalSobras = c.sobras.reduce((s, v) => s + v.bruto, 0);
  const totalContado = arred(casadasNasBandeiras + totalSobras);
  if (Math.abs(totalPlanilha - totalContado) > TOLERANCIA)
    problemas.push('Total da planilha de vendas (' + brl(totalPlanilha) + ') não bate com a soma das notas usadas nas bandeiras + saídas (' + brl(totalContado) + ').');

  return { ok: problemas.length === 0, problemas };
}

const mesDaVenda = (v: Venda): Mes => ({ ano: v.data.getFullYear(), mes: v.data.getMonth() + 1 });

/**
 * Totais de cada mês (renderTotalsBreakdown): meses das bandeiras + meses das sobras, em ordem
 * de chave como TEXTO (como o original: '2026-10' vem antes de '2026-9').
 */
export function totaisPorMes(c: Conciliacao, ordem: IdBandeira[]): TotalDoMes[] {
  const meses: Record<string, Mes> = {};
  for (const id of ordem) for (const m of doResultado(c, id).meses) meses[chaveMes(m)] = { mes: m.mes, ano: m.ano };
  for (const v of c.sobras) { const m = mesDaVenda(v); meses[chaveMes(m)] = m; }

  return Object.keys(meses).sort().map(k => {
    const m = meses[k];
    const semCartao = arred(c.sobras.filter(v => chaveMes(mesDaVenda(v)) === k).reduce((s, v) => s + v.bruto, 0));
    let comCartao = 0;
    for (const id of ordem) {
      for (const l of doResultado(c, id).linhas) if (l.tipo === 'Bruto' && l.casou && chaveMesDaData(l.chaveData) === k) comCartao += l.valor;
    }
    comCartao = arred(comCartao);
    const porBandeira = ordem.map(id => {
      const linhas = doResultado(c, id).linhas;
      const bruto = linhas.filter(l => l.tipo === 'Bruto' && chaveMesDaData(l.chaveData) === k).reduce((s, l) => s + l.valor, 0);
      const taxa = linhas.filter(l => l.tipo === 'Taxa' && chaveMesDaData(l.chaveData) === k).reduce((s, l) => s + l.valor, 0);
      return { id, bruto: arred(bruto), taxa: arred(taxa) };
    });
    return { mes: m, rotulo: rotuloMes(m), vendasComCartao: comCartao, vendasSemCartao: semCartao, totalVendas: arred(comCartao + semCartao), porBandeira };
  });
}
