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

/**
 * Os históricos padrão do SCI do Vitor (27/11/2026): "813 Pagamento de título nº" e "478 Recebimento de clientes cfe NF nº". O
 * complemento leva o número e o nome (o que a provisão diz), porque o histórico termina no "nº".
 */
export const HISTORICO_DO_PAGAMENTO = '813';
export const HISTORICO_DO_RECEBIMENTO = '478';
/** a multa e os juros (27/11/2026, o Vitor: "recorra ao banco, se tem multa e juros"): o extrato pode ter até 30% a mais, em até 120 dias */
export const ACRESCIMO_MAXIMO = 0.3;
export const DIAS_DO_ACRESCIMO = 120;

export interface OpcoesDoPagamento {
  /** a conta da provisão (o código reduzido) */
  conta: string;
  lado: 'credito' | 'debito';
  /** a conta do caixa no SCI (o código reduzido) */
  caixa: string;
  /** a conta do banco no SCI e as linhas do extrato (vazio = tudo pelo caixa) */
  banco?: string;
  extrato?: readonly LinhaDoExtratoParaPagar[];
  /** a conta da multa e dos juros pagos (a despesa financeira): o que o extrato pagou a mais que a provisão */
  juros?: string;
  /** o número do histórico padrão do SCI do pagamento */
  historico: string;
  /** as linhas do extrato já usadas (o fechamento passa a mesma para todas as contas: cada linha paga uma provisão só) */
  usadas?: Set<number>;
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
  /** a multa e os juros: o que o extrato pagou a mais (D a conta de juros × C o banco) */
  acrescimo?: CamposDoLancamento;
  /** por onde: o banco (achou no extrato) ou o caixa */
  pelo: 'banco' | 'caixa';
  provisao: LancamentoDaConsulta;
  /** a linha do extrato que pagou (o índice), no banco */
  linhaDoExtrato?: number;
}

/** A chave de uma provisão (a conta e o lançamento): a tela guarda por ela o "deixar em aberto". */
export const chaveDaProvisao = (conta: string, p: LancamentoDaConsulta) => [conta, p.data, p.valor, p.documento, p.complemento].join('|');

const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/**
 * Os pagamentos das provisões abertas: cada uma vira um lançamento do valor aberto.
 *   1. pelo banco, quando o extrato tem a linha do mesmo valor (a saída, no passivo; a entrada, no a receber) na data da provisão ou
 *      depois, ainda não usada;
 *   2. no passivo, pelo banco com multa e juros, quando o extrato tem a saída maior (até 30% a mais, em até 120 dias): a provisão
 *      paga e o acréscimo na conta de juros, os dois na data do extrato;
 *   3. senão, pelo caixa, no último dia útil do mês da provisão.
 * Primeiro os valores iguais de todas, depois os com acréscimo (um igual nunca é tomado por outro com juros). O complemento leva o
 * número e o nome da provisão (o documento; sem ele, o mês da provisão, MMAAAA).
 */
export function pagamentosDasProvisoes(abertas: readonly ProvisaoAberta[], o: OpcoesDoPagamento): PagamentoGerado[] {
  const usadas = o.usadas || new Set<number>();
  const extrato = o.banco ? o.extrato || [] : [];
  const sinal = o.lado === 'credito' ? -1 : 1;
  const lista = abertas.filter(x => x.aberto > 0);
  const linha = new Map<ProvisaoAberta, number>();
  for (const x of lista) {
    const i = extrato.findIndex((e, k) => !usadas.has(k) && e.valor === sinal * x.aberto && e.data >= x.lancamento.data);
    if (i >= 0) { usadas.add(i); linha.set(x, i); }
  }
  if (o.lado === 'credito') {
    for (const x of lista) {
      if (linha.has(x)) continue;
      let melhor = -1;
      extrato.forEach((e, k) => {
        const pago = -e.valor;
        if (usadas.has(k) || pago <= x.aberto || pago > Math.round(x.aberto * (1 + ACRESCIMO_MAXIMO)) || e.data < x.lancamento.data || diasEntre(x.lancamento.data, e.data) > DIAS_DO_ACRESCIMO) return;
        if (melhor < 0 || e.data < extrato[melhor].data) melhor = k;
      });
      if (melhor >= 0) { usadas.add(melhor); linha.set(x, melhor); }
    }
  }
  return lista.map(x => {
    const p = x.lancamento;
    const i = linha.get(x);
    const pelo: 'banco' | 'caixa' = i != null ? 'banco' : 'caixa';
    const contra = pelo === 'banco' ? o.banco! : o.caixa;
    const data = i != null ? extrato[i].data : (/^\d{4}-\d{2}/.test(p.data) ? ultimoDiaUtil(p.data.slice(0, 7)) : '');
    // o documento é obrigatório no SCI: o da provisão; sem ele, o mês da provisão (MMAAAA)
    const documento = p.documento || (/^\d{4}-\d{2}/.test(p.data) ? p.data.slice(5, 7) + p.data.slice(0, 4) : '');
    const participante = o.lado === 'credito' ? p.participanteC : p.participanteD;
    // o histórico termina no "nº": o complemento começa pelo número (o complemento do fiscal já começa: "245 - CLIENTE")
    const texto = p.complemento.trim();
    const complemento = !texto ? documento : documento && !texto.startsWith(documento) ? documento + ' - ' + texto : texto;
    const lancamento: CamposDoLancamento = o.lado === 'credito'
      ? { data, debito: o.conta, credito: contra, valor: x.aberto, historico: o.historico, complemento, documento, participanteD: participante, participanteC: '' }
      : { data, debito: contra, credito: o.conta, valor: x.aberto, historico: o.historico, complemento, documento, participanteD: '', participanteC: participante };
    const pago = i != null ? Math.abs(extrato[i].valor) : x.aberto;
    const acrescimo: CamposDoLancamento | undefined = pago > x.aberto
      ? { data, debito: o.juros || '', credito: contra, valor: pago - x.aberto, historico: o.historico, complemento: 'Multa e juros - ' + complemento, documento, participanteD: '', participanteC: '' }
      : undefined;
    return { lancamento, ...(acrescimo ? { acrescimo } : {}), pelo, provisao: p, ...(i != null ? { linhaDoExtrato: i } : {}) };
  });
}

/** Uma conta do balancete para o fechamento: o código reduzido, a classificação e o nome. */
export interface ContaParaFechar { codigo: string; classificacao: string; nome: string }

export interface OpcoesDoFechamento {
  caixa: string;
  banco?: string;
  extrato?: readonly LinhaDoExtratoParaPagar[];
  /** o histórico do pagamento (passivo) e o do recebimento (a receber) */
  historicoPagamento: string;
  historicoRecebimento: string;
  /** o período das provisões que entram (aaaa-mm, os dois inclusive) */
  de: string;
  ate: string;
  /** a conta da multa e dos juros */
  juros?: string;
  /** o que não está no extrato fica em aberto, em vez de ir para o caixa (27/11/2026: "ajustavel na aplicacao para termos controle") */
  semCaixa?: boolean;
  /** as provisões que a pessoa deixou em aberto (chaveDaProvisao) */
  deixarAbertas?: ReadonlySet<string>;
}

export interface PagamentoDoFechamento extends PagamentoGerado { conta: ContaParaFechar; chave: string }

export interface Fechamento {
  pagamentos: PagamentoDoFechamento[];
  /** as que ficaram em aberto (a pessoa deixou, ou o caixa desligado), com o pagamento que teriam */
  abertas: PagamentoDoFechamento[];
  /** por conta: quantos, quanto pelo banco e quanto pelo caixa */
  porConta: { conta: ContaParaFechar; qtd: number; banco: number; caixa: number }[];
  /** o que os pagamentos mexem no banco e no caixa (centavos; + entra, − sai) */
  movimentoNoBanco: number;
  movimentoNoCaixa: number;
  /** as linhas do extrato do período que não pagaram nenhuma provisão (o que a pessoa resolve na aba Extratos) */
  extratoSemProvisao: LinhaDoExtratoParaPagar[];
}

/**
 * O fechamento do período (27/11/2026, o Vitor: "Exportar uma planilha com tudo pago, conciliacao bancaria com o extrato batendo e o
 * que nao tem no banco jogar caixa com os pespectivos historicos"): as provisões abertas de todas as contas no período viram os
 * pagamentos, uma linha do extrato paga uma provisão só (entre todas as contas), e diz o que sobrou do extrato.
 */
export function fechamentoDoPeriodo(todos: readonly LancamentoDaConsulta[], contas: readonly ContaParaFechar[], o: OpcoesDoFechamento): Fechamento {
  const usadas = new Set<number>();
  const pagamentos: PagamentoDoFechamento[] = [];
  const deixadas: PagamentoDoFechamento[] = [];
  const porConta: Fechamento['porConta'] = [];
  const noPeriodo = (data: string) => data.slice(0, 7) >= o.de && data.slice(0, 7) <= o.ate;
  for (const conta of contas) {
    const p = provisoesDaConta(todos, conta.codigo, conta.classificacao);
    if (!p || !p.aberto) continue;
    const abertas = p.meses.flatMap(m => m.provisoes).filter(x => x.aberto > 0 && noPeriodo(x.lancamento.data));
    if (!abertas.length) continue;
    const todas = pagamentosDasProvisoes(abertas, {
      conta: conta.codigo, lado: p.lado, caixa: o.caixa, banco: o.banco, extrato: o.extrato, usadas, juros: o.juros,
      historico: p.lado === 'credito' ? o.historicoPagamento : o.historicoRecebimento,
    });
    const g: PagamentoDoFechamento[] = [];
    for (const x of todas) {
      const comConta = { ...x, conta, chave: chaveDaProvisao(conta.codigo, x.provisao) };
      // deixada em aberto: a linha do extrato que ela usaria volta a ficar livre
      if (o.deixarAbertas?.has(comConta.chave) || (o.semCaixa && x.pelo === 'caixa')) {
        if (x.linhaDoExtrato != null) usadas.delete(x.linhaDoExtrato);
        deixadas.push(comConta);
      } else g.push(comConta);
    }
    pagamentos.push(...g);
    if (!g.length) continue;
    porConta.push({
      conta, qtd: g.length,
      banco: g.filter(x => x.pelo === 'banco').reduce((t, x) => t + x.lancamento.valor + (x.acrescimo?.valor || 0), 0),
      caixa: g.filter(x => x.pelo === 'caixa').reduce((t, x) => t + x.lancamento.valor, 0),
    });
  }
  // + entra, − sai: o pagamento do passivo sai; o recebimento do a receber entra
  const movimento = (pelo: 'banco' | 'caixa') => pagamentos.filter(x => x.pelo === pelo)
    .reduce((t, x) => t + (x.lancamento.credito === (pelo === 'banco' ? o.banco : o.caixa) ? -x.lancamento.valor : x.lancamento.valor) - (x.acrescimo?.valor || 0), 0);
  const extratoSemProvisao = (o.banco ? o.extrato || [] : []).filter((e, k) => !usadas.has(k) && noPeriodo(e.data));
  return { pagamentos, abertas: deixadas, porConta, movimentoNoBanco: movimento('banco'), movimentoNoCaixa: movimento('caixa'), extratoSemProvisao };
}

