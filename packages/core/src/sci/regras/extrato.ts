// Extrato → SCI (25/11/2026: "Adapte a ferramenta nads → SCI para extratos bancários e coloque o resultado como uma função dentro
// do minimum"): o PDF do extrato, lido pelo leitor do Rotinas (extrator.lerArquivo), vira os lançamentos da planilha do gerador
// do SCI (o modelo "nads", planilhaDoSci). Cada linha é a conta do banco contra a contrapartida, que vem, nesta ordem: o que a
// pessoa escolheu na linha, uma regra criada no minimum (já nas contas do SCI), uma regra do Lançatudo da empresa ou a conta que o
// Lançatudo aprendeu do favorecido (as duas nas contas do nads, que passam pelo de/para). Sem nada, a linha fica em branco para a
// pessoa escolher (decisão do dono, 25/11/2026) e, se baixar assim, vai para a aba Conferir. Tudo no navegador: nada vai para o banco.
import type { Lancamento, ConferenciaPeloSaldo } from '../../extratudo/extrator/tipos';
import { chavesDasLinhas } from '../../lancatudo/regras/registro';
import { chaveLembrada, historicoLimpo, historicoPelaRegra, regraDaLinha, regraSugerida } from '../../lancatudo/regras/motor';
import type { ContaLembrada, RegraDoLancatudo } from '../../lancatudo/tipos';
import type { DeParaDasContas, LancamentoSci, LinhaDoNads } from '../tipos';
import { historicoDoSci } from './historicos';
import { lancamentosParaOSci, loteDaOrigem, mesPrincipal } from './planilha';
import { contaDoPlano, type PlanoSci } from './plano';

/** O número do histórico padrão do SCI do que entrou no banco e do que saiu. */
export interface HistoricosPadrao { entrada: string; saida: string }

/** De onde veio a contrapartida da linha. */
export type OrigemNoExtratoSci = 'pessoa' | 'minimum' | 'regra' | 'aprendida';

/** O que a pessoa decidiu numa linha da grade (vale mais que as regras). */
export interface DecisaoNoExtratoSci {
  /** a contrapartida, no código do SCI ('' = tirou a conta: a linha fica em branco, mesmo com regra) */
  conta?: string;
  /** o número do histórico padrão do SCI só desta linha */
  historico?: string;
  /** a linha fica fora da planilha (já lançada de outro jeito, a aplicação automática...) */
  ignorar?: boolean;
}

export interface EntradaDoExtratoSci {
  /** os lançamentos do extrato (o que o leitor leu): + entrou, − saiu, em centavos */
  lancamentos: readonly Lancamento[];
  /** o id da conta bancária (as regras do Lançatudo podem valer só nela) */
  banco: string;
  /** o código da conta do banco no SCI ('' = falta) */
  contaDoBanco: string;
  plano: PlanoSci;
  /** as regras criadas no minimum: a conta já no código do SCI; valem antes das do Lançatudo */
  regrasDoMinimum?: readonly RegraDoLancatudo[];
  /** as regras do Lançatudo da empresa (as importadas do Mister): a conta no código do nads */
  regrasDoLancatudo?: readonly RegraDoLancatudo[];
  /** o que o Lançatudo aprendeu de cada favorecido (conta do nads) */
  lembradas?: Readonly<Record<string, ContaLembrada>>;
  /** o de/para das contas do nads para o SCI (o automático pelo plano do Cadastro); vazio = os códigos valem como estão */
  dePara?: DeParaDasContas | null;
  /**
   * o número do histórico padrão do SCI do que entrou e do que saiu (o recebimento não é "Pagamento"); a decisão da linha e a
   * regra do minimum valem mais
   */
  historicoPadrao: HistoricosPadrao;
  /** as decisões da pessoa, pela chave da linha */
  decisoes?: Readonly<Record<string, DecisaoNoExtratoSci>>;
}

/** Uma linha da grade: a do extrato com as duas contas do SCI e o que falta nela. */
export interface LinhaDoExtratoSci {
  /** a chave estável da linha (a mesma do Lançatudo: dia, valor, histórico e a ocorrência) */
  chave: string;
  data: string;
  /** centavos; + entrou, − saiu */
  valor: number;
  historicoDoBanco: string;
  /** a contrapartida no SCI; '' = em branco */
  contrapartida: string;
  nomeDaContrapartida: string;
  origem: OrigemNoExtratoSci | null;
  /** a pessoa mexeu na conta desta linha: dá para voltar ao automático */
  contaEscolhida: boolean;
  /** o nome da regra que deu a conta */
  regra: string;
  /** a conta da regra que não tem par no SCI (a linha fica em branco, com o aviso) */
  semPar: string;
  debito: string;
  credito: string;
  /** o número do histórico padrão do SCI */
  historico: string;
  /** o texto do histórico (o do banco, ou o da regra), no complemento */
  complemento: string;
  ignorada: boolean;
}

const so = (s: string) => s.trim();

/**
 * A conta do nads no SCI: pelo de/para; sem de/para nenhum (a empresa sem plano no Cadastro), o mesmo código, se ele existe no
 * plano do SCI. Com de/para, a conta sem par não vale (o mesmo número no SCI pode ser outra conta). '' = sem conta no SCI.
 */
export function contaDoNadsNoSci(codigo: string, dePara: DeParaDasContas | null | undefined, plano: PlanoSci): string {
  const c = so(codigo);
  if (!c) return '';
  if (dePara && dePara.size) return dePara.get(c)?.codigo || '';
  return contaDoPlano(plano, c) ? contaDoPlano(plano, c)!.codigo : '';
}

/** As linhas da grade: a contrapartida, as contas de débito e crédito, o histórico e o complemento de cada linha do extrato. */
export function linhasDoExtratoSci(e: EntradaDoExtratoSci): LinhaDoExtratoSci[] {
  const chaves = chavesDasLinhas(e.lancamentos);
  const banco = so(e.contaDoBanco);
  const doBanco = banco ? contaDoPlano(e.plano, banco)?.codigo || banco : '';
  return e.lancamentos.map((l, i) => {
    const chave = chaves[i];
    const d = e.decisoes?.[chave] || {};
    const linha = { historico: l.historico, valor: l.valor };
    let contrapartida = '';
    let origem: OrigemNoExtratoSci | null = null;
    let regra = '';
    let semPar = '';
    let complemento = historicoLimpo(l.historico);
    let historico = '';
    const escolhida = d.conta !== undefined;
    if (escolhida) {
      contrapartida = so(d.conta || '');
      origem = contrapartida ? 'pessoa' : null;
    }
    const doMinimum = regraDaLinha(e.regrasDoMinimum || [], linha, e.banco);
    const doLancatudo = doMinimum ? null : regraDaLinha(e.regrasDoLancatudo || [], linha, e.banco);
    const valeARegra = doMinimum || doLancatudo;
    if (valeARegra) complemento = historicoPelaRegra(valeARegra, l.historico);
    if (doMinimum?.codHistorico) historico = doMinimum.codHistorico;
    if (!escolhida) {
      if (doMinimum) {
        contrapartida = so(doMinimum.conta);
        origem = 'minimum';
        regra = doMinimum.descricao || doMinimum.expressao;
      } else if (doLancatudo) {
        contrapartida = contaDoNadsNoSci(doLancatudo.conta, e.dePara, e.plano);
        regra = doLancatudo.descricao || doLancatudo.expressao;
        if (contrapartida) origem = 'regra';
        else semPar = doLancatudo.conta;
      } else {
        const k = chaveLembrada(l.historico, l.valor);
        const lembrada = k ? e.lembradas?.[k] : undefined;
        if (lembrada) {
          contrapartida = contaDoNadsNoSci(lembrada.conta, e.dePara, e.plano);
          if (contrapartida) origem = 'aprendida';
          else semPar = lembrada.conta;
        }
      }
    }
    // a conta pelo apelido (CX, BB...) vira o código reduzido
    const daConta = contrapartida ? contaDoPlano(e.plano, contrapartida) : null;
    if (daConta) contrapartida = daConta.codigo;
    if (d.historico !== undefined && so(d.historico)) historico = so(d.historico);
    if (!historico) historico = so(l.valor > 0 ? e.historicoPadrao.entrada : e.historicoPadrao.saida);
    const hist = historicoDoSci(historico);
    if (hist) historico = hist.codigo;
    const entrou = l.valor > 0;
    return {
      chave, data: l.data, valor: l.valor, historicoDoBanco: l.historico, contrapartida, nomeDaContrapartida: daConta?.nome || '', origem,
      contaEscolhida: escolhida, regra, semPar,
      debito: entrou ? doBanco : contrapartida, credito: entrou ? contrapartida : doBanco,
      historico, complemento, ignorada: !!d.ignorar,
    };
  });
}

/** O que impede a linha de ir para o SCI, além do que a planilha do SCI já confere (vazio = pronta). */
function problemasDaLinha(l: LinhaDoExtratoSci): string[] {
  const p: string[] = [];
  if (!l.contrapartida) p.push(l.semPar ? 'a conta ' + l.semPar + ' do nads não tem par no SCI' : 'sem contrapartida');
  if (l.historico && !/^\d+$/.test(l.historico)) p.push('o histórico é só o número do histórico padrão do SCI');
  return p;
}

export interface OpcoesDoExtratoSci {
  /** o CNPJ da empresa (matriz ou filial) */
  cnpjEmpresa: string;
  /** o lote (até 10 letras); sem = o do extrato (loteDoExtrato) */
  lote?: string;
  /** o nome do banco, para o lote e a origem ("Sicoob") */
  nomeDoBanco: string;
  plano: PlanoSci;
}

/** O lote de um extrato (decisão do dono, 25/11/2026: "um por extrato"): as 4 primeiras letras do banco + AAMM (SICO2611, BB2611). */
export function loteDoExtrato(nomeDoBanco: string, mes: string): string {
  return loteDaOrigem(nomeDoBanco, mes);
}

/**
 * Os lançamentos do SCI das linhas da grade, pela mesma conferência da ferramenta nads → SCI (lancamentosParaOSci: data, contas
 * no plano do SCI, valor, histórico, CNPJ, participante), mais a da linha (sem contrapartida, a conta sem par). As ignoradas não vão.
 */
export function lancamentosDoExtratoSci(linhas: readonly LinhaDoExtratoSci[], op: OpcoesDoExtratoSci): LancamentoSci[] {
  const vao = linhas.filter(l => !l.ignorada);
  const origem = 'extrato ' + op.nomeDoBanco.trim();
  const doNads: LinhaDoNads[] = vao.map(l => ({
    data: l.data, debito: l.debito, credito: l.credito, valor: Math.abs(l.valor), codHistorico: l.historico, complemento: l.complemento, documento: '', origem,
  }));
  const lote = (op.lote?.trim() || loteDoExtrato(op.nomeDoBanco, mesPrincipal(vao))).toUpperCase();
  const lancamentos = lancamentosParaOSci(doNads, { cnpjEmpresa: op.cnpjEmpresa, lote, planoSci: op.plano });
  return lancamentos.map((x, i) => {
    const l = vao[i];
    const proprios = problemasDaLinha(l);
    const semBanco = !(l.valor > 0 ? l.debito : l.credito);
    if (semBanco) proprios.unshift('falta a conta do banco no SCI');
    if (!proprios.length) return x;
    // o "sem conta de débito/crédito" da planilha já está dito acima (a contrapartida ou a conta do banco)
    return { ...x, problemas: [...proprios, ...x.problemas.filter(p => !/^sem conta de (débito|crédito)$/.test(p))] };
  });
}

/** A conferência do extrato pelo saldo do banco: o saldo anterior, o movimento, o saldo final e os saldos impressos que não fecham. */
export interface SaldoDoExtrato {
  /** centavos; null = o extrato não traz o saldo anterior */
  saldoAnterior: number | null;
  entradas: number;
  /** positivo */
  saidas: number;
  /** o saldo anterior + o movimento; null sem saldo anterior */
  saldoFinal: number | null;
  /** quantos saldos impressos foram conferidos (0 = o extrato não traz saldo por dia) */
  conferidos: number;
  naoFecham: number;
  exemplos: ConferenciaPeloSaldo['exemplos'];
  /** true = todos os saldos impressos fecham; false = algum não fecha; null = não deu para conferir */
  fecha: boolean | null;
}

export function saldoDoExtrato(lido: { lancamentos: readonly Lancamento[]; saldoAnterior?: number; conferenciaPeloSaldo?: ConferenciaPeloSaldo }): SaldoDoExtrato {
  let entradas = 0, saidas = 0;
  for (const l of lido.lancamentos) { if (l.valor > 0) entradas += l.valor; else saidas -= l.valor; }
  const saldoAnterior = lido.saldoAnterior ?? null;
  const c = lido.conferenciaPeloSaldo;
  const conferidos = c?.conferidos || 0;
  const naoFecham = c?.naoFecham || 0;
  return {
    saldoAnterior, entradas, saidas, saldoFinal: saldoAnterior == null ? null : saldoAnterior + entradas - saidas,
    conferidos, naoFecham, exemplos: c?.exemplos || [], fecha: conferidos ? naoFecham === 0 : null,
  };
}

let contadorDeRegras = 0;

/**
 * A regra do minimum a partir de uma linha da grade (decisão do dono, 25/11/2026: a regra fica só no minimum, nas contas do SCI):
 * o favorecido pelo CPF/CNPJ quando o histórico tem, senão o texto do histórico sem números, no sentido da linha.
 */
export function regraDoMinimumDaLinha(l: Pick<LinhaDoExtratoSci, 'historicoDoBanco' | 'valor'>, conta: string, quem: string, agora: Date, historico = ''): RegraDoLancatudo {
  const s = regraSugerida({ historico: l.historicoDoBanco, valor: l.valor });
  return {
    id: 'min-' + agora.getTime().toString(36) + (contadorDeRegras++).toString(36),
    tipo: s.tipo, expressao: s.expressao, sentido: s.sentido, conta: conta.trim(), comHistoricoDoExtrato: true,
    ...(historico.trim() ? { codHistorico: historico.trim() } : {}),
    criadaEm: agora.toISOString(), por: quem,
  };
}

/** Os números da grade. */
export interface ResumoDoExtratoSci { linhas: number; comConta: number; emBranco: number; ignoradas: number }

export function resumoDoExtratoSci(linhas: readonly LinhaDoExtratoSci[]): ResumoDoExtratoSci {
  let comConta = 0, emBranco = 0, ignoradas = 0;
  for (const l of linhas) {
    if (l.ignorada) ignoradas++;
    else if (l.contrapartida) comConta++;
    else emBranco++;
  }
  return { linhas: linhas.length, comConta, emBranco, ignoradas };
}
