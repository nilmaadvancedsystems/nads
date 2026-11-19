// O razão do banco pelo robô do Alterdata do servidor (19/11/2026: "preciso que tenha a função de atualizar o balancete, ele vai
// chamar o alterdata do servidor e atualizar"). O pedido mensal da fila do robô traz o razão de todas as contas, com a
// contrapartida de cada linha; daqui sai o razão da conta do banco no mês, que toma o lugar do razão que alguém subiu no
// Extrator: o que já está lançado no Alterdata fica "no razão", e as contrapartidas viram os modelos da sugestão.
import type { Lancamento } from '../../extratudo/extrator/tipos';
import type { LancamentoDoRobo } from '../../tarefas/regras/diario';
import type { DadosDoBanco } from './registro';

/**
 * As linhas da conta do banco no mês, no jeito do razão da conciliação do Alterdata (o que a conferência do nads espera): o
 * valor em centavos, + o crédito da conta (o que saiu do banco) e − o débito (o que entrou); a conta é a contrapartida (sem
 * ela, a linha fica sem modelo). O robô manda os valores em reais.
 */
export function razaoDaContaDoServidor(lancamentos: readonly LancamentoDoRobo[], contaDoBanco: string, competencia: string): Lancamento[] {
  const conta = contaDoBanco.trim();
  if (!conta) return [];
  const out: Lancamento[] = [];
  for (const l of lancamentos) {
    if (l.conta !== conta || !l.data.startsWith(competencia)) continue;
    const valor = Math.round(((Number(l.credito) || 0) - (Number(l.debito) || 0)) * 100);
    if (!valor) continue;
    const contra = (l.contra || '').trim();
    out.push({ data: l.data, valor, historico: l.historico || '', ...(contra && contra !== conta ? { conta: contra } : {}) });
  }
  return out;
}

/**
 * Os dados do banco com o razão do servidor no mês: ele substitui o razão do Extrator do mês; os modelos são os dele e os do
 * Extrator, estes acertados para o mesmo jeito (o do Alterdata: o crédito positivo, invertido em relação ao extrato).
 */
export function comRazaoDoServidor(d: DadosDoBanco, razao: readonly Lancamento[]): DadosDoBanco {
  const doExtrator = d.razaoInvertido ? d.modelos : d.modelos.map(l => ({ ...l, valor: -l.valor }));
  return { extrato: d.extrato, razaoDoMes: [...razao], modelos: [...razao.filter(l => !!l.conta), ...doExtrator], razaoInvertido: true };
}
