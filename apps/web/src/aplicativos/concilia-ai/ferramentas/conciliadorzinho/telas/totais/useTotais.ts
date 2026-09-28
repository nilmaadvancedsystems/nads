// ViewModel da etapa Totais: a conferência antes de liberar os arquivos (bruto e taxa de cada
// bandeira contra o extrato; toda venda usada uma vez só) e o resumo por mês.
// Origem: conciliadorZINHO.html validateTotals (~L1640), renderTotalsBreakdown (~L1673),
// runTotalsValidation (~L1717: se não bater, refaz uma vez; se ainda não bater, pede os arquivos de novo).
import { conciliadorzinho as cz } from '@nads/core';
import { conciliarTudo, useSessao } from '../../casca/sessao';

export function useTotais() {
  const s = useSessao();
  let r = s.estado.resultado;
  // refaz do zero uma vez, como o original, antes de desistir
  if (r && !r.conferencia.ok) r = conciliarTudo(s.estado);
  const meses = r && r.conferencia.ok ? cz.totaisPorMes(r.conciliacao, r.ordem) : [];
  const todosMeses = r ? r.ordem.flatMap(id => r.conciliacao.porBandeira[id]?.meses || []) : [];

  return {
    ok: !!r && r.conferencia.ok,
    problemas: r ? r.conferencia.problemas : [],
    meses: meses.map(m => ({
      ...m,
      linhas: m.porBandeira.map(p => ({ ...p, rotulo: cz.bandeira(p.id).rotulo })),
    })),
    /** nome do PDF: conferencia-conciliacao-<meses> */
    tituloPdf: 'conferencia-conciliacao-' + (todosMeses.length ? cz.slugMeses(unicos(todosMeses)) : 'periodo'),
    voltar: s.anterior,
    baixarArquivos: s.proxima,
    recomecar: s.recomecar,
  };
}

function unicos(ms: cz.Mes[]): cz.Mes[] {
  const vistos = new Map<string, cz.Mes>();
  for (const m of ms) vistos.set(cz.chaveMes(m), m);
  return [...vistos.values()];
}
