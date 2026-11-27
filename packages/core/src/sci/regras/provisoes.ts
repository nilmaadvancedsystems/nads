// As provisões de uma conta, mês a mês, e os pagamentos que faltam (27/11/2026, o Vitor: "esse balancete quero o relatorio de todos
// os lancamentos de cada conta em um dropdown, onde eu consigo ver as provisoes e pedir para o sistema identificar quais meses tao com
// pagamento e quais estao sem, e diretamente de la, com um botao ele ja gerar os lancamentos e pagar sem esforco"; o objetivo final:
// "Exportar uma planilha com tudo pago, conciliacao bancaria com o extrato batendo e o que nao tem no banco jogar caixa").
//
// Com os lançamentos que o SCI tem (a consulta da Contabilização):
//   - a conta do passivo (02: fornecedores, impostos, salários a pagar): a provisão é o crédito, o pagamento é o débito;
//   - a conta do ativo a receber (01, fora do disponível 01.1.1: clientes): a provisão é o débito, o recebimento é o crédito.
// Cada pagamento quita primeiro a provisão de mesmo valor ainda aberta (a mais antiga); o que sobra quita as mais antigas, em ordem.
// O que ficou aberto vira o pagamento: pelo banco quando o extrato tem a saída (ou a entrada) do mesmo valor, na data do extrato; senão,
// pelo caixa, no último dia do mês da provisão.
import type { LancamentoDaConsulta } from './consulta';
import { diaSemLancamento } from './dias';
import type { CamposDoLancamento } from './lancamentos';

/** De que lado a conta provisiona: o passivo no crédito, o a receber no débito. null = a conta não tem provisão (caixa, receita…). */
export function ladoDaProvisao(classificacao: string): 'credito' | 'debito' | null {
  const c = classificacao.replace(/\s/g, '');
  if (/^0?2(\.|$)/.test(c)) return 'credito';
  if (/^0?1(\.|$)/.test(c) && !/^0?1\.0?1\.0?1(\.|$)/.test(c)) return 'debito';
  return null;
}

export interface ProvisaoAberta {
  /** o lançamento da provisão */
  lancamento: LancamentoDaConsulta;
  /** centavos ainda sem pagamento */
  aberto: number;
}

export interface MesDaProvisao {
  /** aaaa-mm */
  mes: string;
  /** centavos provisionados no mês */
  provisionado: number;
  /** centavos dessas provisões que já têm pagamento */
  pago: number;
  aberto: number;
  situacao: 'pago' | 'parcial' | 'aberto';
  /** as provisões do mês com o que falta de cada uma */
  provisoes: ProvisaoAberta[];
}

export interface ProvisoesDaConta {
  lado: 'credito' | 'debito';
  /** todos os lançamentos da conta, por data */
  lancamentos: LancamentoDaConsulta[];
  meses: MesDaProvisao[];
  /** os pagamentos que sobraram sem provisão (pagou mais do que provisionou) */
  pagoSemProvisao: number;
  aberto: number;
}

const ladoDe = (l: LancamentoDaConsulta, conta: string): 'debito' | 'credito' | null => (l.debito === conta ? 'debito' : l.credito === conta ? 'credito' : null);

/** As provisões da conta (o código reduzido no SCI) e o que cada mês tem de pagamento. null = a conta não provisiona. */
export function provisoesDaConta(todos: readonly LancamentoDaConsulta[], conta: string, classificacao: string): ProvisoesDaConta | null {
  const lado = ladoDaProvisao(classificacao);
  if (!lado || !conta) return null;
  const daConta = todos.filter(l => l.debito === conta || l.credito === conta).sort((a, b) => a.data.localeCompare(b.data));
  const provisoes = daConta.filter(l => ladoDe(l, conta) === lado).map(l => ({ lancamento: l, aberto: l.valor }));
  const pagamentos = daConta.filter(l => ladoDe(l, conta) !== lado && !(l.debito === conta && l.credito === conta));
  let pagoSemProvisao = 0;
  for (const p of pagamentos) {
    let resta = p.valor;
    // o mesmo valor primeiro (o pagamento daquela provisão), a mais antiga aberta
    const igual = provisoes.find(x => x.aberto === resta && x.lancamento.data <= (p.data || '9999'));
    if (igual) { igual.aberto = 0; continue; }
    for (const x of provisoes) {
      if (!resta) break;
      if (!x.aberto || x.lancamento.data > (p.data || '9999')) continue;
      const usa = Math.min(x.aberto, resta);
      x.aberto -= usa;
      resta -= usa;
    }
    pagoSemProvisao += resta;
  }
  const porMes = new Map<string, ProvisaoAberta[]>();
  for (const x of provisoes) {
    const m = x.lancamento.data.slice(0, 7) || 'sem data';
    porMes.set(m, [...(porMes.get(m) || []), x]);
  }
  const meses = [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, ps]): MesDaProvisao => {
    const provisionado = ps.reduce((t, x) => t + x.lancamento.valor, 0);
    const aberto = ps.reduce((t, x) => t + x.aberto, 0);
    return { mes, provisionado, pago: provisionado - aberto, aberto, situacao: !aberto ? 'pago' : aberto === provisionado ? 'aberto' : 'parcial', provisoes: ps };
  });
  return { lado, lancamentos: daConta, meses, pagoSemProvisao, aberto: meses.reduce((t, m) => t + m.aberto, 0) };
}

/** Uma linha do extrato para casar com o pagamento: a data (aaaa-mm-dd) e o valor (centavos; + entrada, − saída). */
export interface LinhaDoExtratoParaPagar { data: string; valor: number; historico: string }

export interface OpcoesDoPagamento {
  /** a conta da provisão (o código reduzido) */
  conta: string;
  lado: 'credito' | 'debito';
  /** a conta do caixa no SCI (o código reduzido) */
  caixa: string;
  /** a conta do banco no SCI e as linhas do extrato (vazio = tudo pelo caixa) */
  banco?: string;
  extrato?: readonly LinhaDoExtratoParaPagar[];
  /** o número do histórico padrão do SCI do pagamento */
  historico: string;
}

/** O último dia útil do mês (aaaa-mm → aaaa-mm-dd): o SCI não aceita lançamento no fim de semana nem no feriado nacional. */
export function ultimoDiaUtil(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  for (let d = new Date(a, m, 0).getDate(); d >= 1; d--) {
    const iso = mes + '-' + String(d).padStart(2, '0');
    if (!diaSemLancamento(iso)) return iso;
  }
  return mes + '-01';
}

export interface PagamentoGerado {
  lancamento: CamposDoLancamento;
  /** por onde: o banco (achou no extrato) ou o caixa */
  pelo: 'banco' | 'caixa';
  provisao: LancamentoDaConsulta;
}

/**
 * Os pagamentos das provisões abertas: cada uma vira um lançamento do valor aberto. Pelo banco quando o extrato tem a linha do mesmo
 * valor (a saída, no passivo; a entrada, no a receber) na data da provisão ou depois, ainda não usada; senão, pelo caixa, no último
 * dia útil do mês da provisão. O participante e o documento da provisão vão junto (sem documento, o mês da provisão, MMAAAA).
 */
export function pagamentosDasProvisoes(abertas: readonly ProvisaoAberta[], o: OpcoesDoPagamento): PagamentoGerado[] {
  const usadas = new Set<number>();
  const extrato = o.banco ? o.extrato || [] : [];
  return abertas.filter(x => x.aberto > 0).map(x => {
    const p = x.lancamento;
    const sinal = o.lado === 'credito' ? -1 : 1;
    const i = extrato.findIndex((e, k) => !usadas.has(k) && e.valor === sinal * x.aberto && e.data >= p.data);
    if (i >= 0) usadas.add(i);
    const pelo: 'banco' | 'caixa' = i >= 0 ? 'banco' : 'caixa';
    const contra = pelo === 'banco' ? o.banco! : o.caixa;
    const data = i >= 0 ? extrato[i].data : (/^\d{4}-\d{2}/.test(p.data) ? ultimoDiaUtil(p.data.slice(0, 7)) : '');
    // o documento é obrigatório no SCI: o da provisão; sem ele, o mês da provisão (MMAAAA)
    const documento = p.documento || (/^\d{4}-\d{2}/.test(p.data) ? p.data.slice(5, 7) + p.data.slice(0, 4) : '');
    const participante = o.lado === 'credito' ? p.participanteC : p.participanteD;
    const complemento = (o.lado === 'credito' ? 'Pagamento ' : 'Recebimento ') + (p.complemento || 'da provisão de ' + p.data.slice(5, 7) + '/' + p.data.slice(0, 4));
    const lancamento: CamposDoLancamento = o.lado === 'credito'
      ? { data, debito: o.conta, credito: contra, valor: x.aberto, historico: o.historico, complemento, documento, participanteD: participante, participanteC: '' }
      : { data, debito: contra, credito: o.conta, valor: x.aberto, historico: o.historico, complemento, documento, participanteD: '', participanteC: participante };
    return { lancamento, pelo, provisao: p };
  });
}
