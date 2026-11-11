// O razão do cartão × as faturas (Vitor, 11/11/2026: "como está no razão correto, monta para mim"). A conta do cartão é de
// passivo e tem dois lados:
// - o crédito (C Cartão): a compra com nota entra pelo título do fornecedor pago com o cartão ("Antecipação de Cartão…" ou
//   "Pagamento de título nº…", D Fornecedor ou Adiantamento / C Cartão), e a compra parcelada entra inteira;
// - o débito (D Cartão / C Banco): cada compra da fatura, no dia em que o banco pagou; a que tem nota leva o texto do título
//   ("Pagamento de título nº 4706/1-…", a parcela depois do número).
// A compra sem nota (o posto pago no cartão) só tinha o débito e a conta ficava devedora: ela entra D Caixa / C Cartão, na
// data da compra (a de antes do período, no dia do pagamento, como no razão). O que já está no razão não sai de novo.
import type { LinhaDeImportacao } from '../../creditor/arquivos/gerar';
import type { ItemDaFatura } from './fatura';

/** Um lançamento do razão do cartão (o XLS da conciliação do Alterdata): valor e saldo negativos = débito/devedor. */
export interface LancamentoDoCartao {
  /** 'aaaa-mm-dd' */
  data: string;
  contrapartida: string;
  nomeContrapartida: string;
  valor: number;
  codigoHistorico: string;
  historico: string;
  saldo: number;
}

export interface RazaoDoCartao {
  lancamentos: readonly LancamentoDoCartao[];
  /** o saldo antes do primeiro lançamento */
  saldoInicial: number;
}

/** Uma fatura para conferir: as compras e o dia em que o banco pagou ('aaaa-mm-dd'). */
export interface FaturaParaConferir { id: string; dia: string; compras: readonly ItemDaFatura[] }

/**
 * com-nota: o crédito do título está no razão; sem-nota: vai D Caixa / C Cartão; parcela-anterior: parcela de compra feita
 * antes do razão (o crédito entrou lá atrás, inteiro).
 */
export type SituacaoDaCompra = 'com-nota' | 'sem-nota' | 'parcela-anterior';

export interface CompraConferida {
  fatura: string;
  item: ItemDaFatura;
  situacao: SituacaoDaCompra;
  /** o crédito do título no razão (com-nota) */
  nota: LancamentoDoCartao | null;
  /** o D Cartão / C Banco já no razão (null = falta lançar) */
  pago: LancamentoDoCartao | null;
  /** o histórico do pagamento: o do título com a parcela, ou a descrição da fatura */
  historicoDoPagamento: string;
}

const cent = (n: number) => Math.round(n * 100);
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
/** "REDECONSTRUIR 01/06 TAIOBEIRAS" → a parcela 1 de 6 */
const RE_PARCELA = /\b(\d{2})\/(\d{2})\b/;
/** o começo dos históricos de título no razão do cartão */
const RE_TITULO = /^\s*(antecipa[çc][ãa]o de cart[ãa]o|pagamento de t[íi]tulo\s+n[º°o.]*)\s*/i;

/** a compra sem a parcela: as parcelas da mesma compra têm a mesma chave */
const chaveDaCompra = (it: ItemDaFatura) => it.data + '|' + it.descricao.replace(RE_PARCELA, '').replace(/\s+/g, ' ').trim();

/** "Antecipação de Cartão 4706-113…" + parcela 2 → "Pagamento de título nº 4706/2-113…" */
export function historicoDoTitulo(historicoDoCredito: string, parcela: number | null): string {
  let resto = historicoDoCredito.replace(RE_TITULO, '').trim();
  if (parcela != null) resto = resto.replace(/^(\d+)(?![\d/])/, '$1/' + parcela);
  return 'Pagamento de título nº ' + resto;
}

/** Cada compra das faturas × o razão do cartão: tem a nota (o crédito do título)? o pagamento já está lançado? */
export function conferirComORazao(faturas: readonly FaturaParaConferir[], r: RazaoDoCartao): CompraConferida[] {
  const inicio = r.lancamentos[0]?.data || '';
  const creditos = r.lancamentos.filter(l => l.valor > 0);
  const debitos = r.lancamentos.filter(l => l.valor < 0);
  const usados = new Set<LancamentoDoCartao>();
  // o crédito de cada compra parcelada, para as parcelas seguintes
  const daCompra = new Map<string, LancamentoDoCartao>();
  const out: CompraConferida[] = [];
  const ordem = [...faturas].sort((a, b) => a.dia.localeCompare(b.dia));
  for (const f of ordem) {
    for (const it of [...f.compras].sort((a, b) => a.data.localeCompare(b.data))) {
      const p = it.descricao.match(RE_PARCELA);
      const parcela = p && Number(p[2]) > 1 ? { k: Number(p[1]), n: Number(p[2]) } : null;
      // o pagamento: o débito do mesmo valor perto do dia em que o banco pagou
      const pago = it.valor > 0
        ? debitos.find(l => !usados.has(l) && cent(-l.valor) === cent(it.valor) && Math.abs(dias(l.data, f.dia)) <= 5) || null
        : null;
      if (pago) usados.add(pago);
      // a nota: o crédito do título entre a compra (dez dias antes) e o pagamento
      const naJanela = (l: LancamentoDoCartao) => dias(l.data, it.data) >= -10 && dias(l.data, f.dia) <= 5;
      let nota: LancamentoDoCartao | null = null;
      let situacao: SituacaoDaCompra = 'sem-nota';
      if (it.valor > 0) {
        if (parcela) {
          const chave = chaveDaCompra(it);
          nota = daCompra.get(chave)
            // a compra inteira: o valor da parcela vezes as parcelas (a última pode ter centavos de diferença)
            || creditos.find(l => !usados.has(l) && naJanela(l) && Math.abs(cent(l.valor) - cent(it.valor) * parcela.n) <= 5 * parcela.n)
            || null;
          if (nota) { usados.add(nota); daCompra.set(chave, nota); situacao = 'com-nota'; }
          else if (inicio && it.data < inicio) situacao = 'parcela-anterior';
        } else {
          nota = creditos.find(l => !usados.has(l) && naJanela(l) && cent(l.valor) === cent(it.valor)) || null;
          if (nota) { usados.add(nota); situacao = 'com-nota'; }
        }
      }
      out.push({
        fatura: f.id, item: it, situacao, nota, pago,
        historicoDoPagamento: nota ? historicoDoTitulo(nota.historico, parcela ? parcela.k : null) : it.descricao,
      });
    }
  }
  return out;
}

const dataBr = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

export interface ContasDoCartao {
  cartao: string;
  caixa: string;
  /** a conta do banco que pagou cada fatura (pelo id da fatura) */
  banco: (fatura: string) => string;
  /** o código de histórico do "Pagamento de título" (o que o razão já usa; '' = sem) */
  historicoDoTitulo: string;
}

/** Um lançamento a importar, com a data ISO (para a ordem e o saldo) e o efeito na conta do cartão (+ crédito, − débito). */
export interface LancamentoDoCartaoAImportar { iso: string; linha: LinhaDeImportacao; efeito: number }

/**
 * O que falta no razão: o pagamento (D Cartão / C Banco, no dia do pagamento) que ainda não está lá e, da compra sem nota,
 * D Caixa / C Cartão na data da compra (antes do período, no dia do pagamento). Estorno entra ao contrário.
 */
export function lancamentosQueFaltam(cs: readonly CompraConferida[], diaDa: (fatura: string) => string, contas: ContasDoCartao, inicioDoPeriodo: string): LancamentoDoCartaoAImportar[] {
  const out: LancamentoDoCartaoAImportar[] = [];
  const linha = (iso: string, debito: string, credito: string, historico: string, valor: number, codHistorico = ''): LinhaDeImportacao =>
    ({ automatico: '', data: dataBr(iso), debito, credito, codHistorico, historico, valor, documento: '' });
  for (const c of cs) {
    const v = Math.abs(c.item.valor);
    const gasto = c.item.valor >= 0;
    const dia = diaDa(c.fatura);
    if (!c.pago) {
      const banco = contas.banco(c.fatura);
      out.push({ iso: dia, efeito: gasto ? -v : v, linha: linha(dia, gasto ? contas.cartao : banco, gasto ? banco : contas.cartao, c.historicoDoPagamento, v, c.nota ? contas.historicoDoTitulo : '') });
    }
    if (c.situacao === 'sem-nota') {
      const iso = c.item.data >= inicioDoPeriodo ? c.item.data : dia;
      out.push({ iso, efeito: gasto ? v : -v, linha: linha(iso, gasto ? contas.caixa : contas.cartao, gasto ? contas.cartao : contas.caixa, c.item.descricao, v) });
    }
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso));
}

/** O código do histórico que o razão usa no "Pagamento de título" ('' = nenhum). */
export function historicoDoPagamentoNoRazao(r: RazaoDoCartao): string {
  return r.lancamentos.find(l => l.valor < 0 && /^\s*pagamento de t[íi]tulo/i.test(l.historico) && l.codigoHistorico)?.codigoHistorico || '';
}

/**
 * O saldo do cartão no fim de cada mês: o da coluna Saldo do razão (o último lançamento até o fim do mês; sem, o saldo
 * inicial) e com os lançamentos que faltam. Positivo = credor (o certo); negativo = devedor.
 */
export function saldosDoCartao(r: RazaoDoCartao, meses: readonly string[], faltam: readonly LancamentoDoCartaoAImportar[]): { mes: string; razao: number; comLancamentos: number }[] {
  return meses.map(mes => {
    const fim = mes + '-31';
    const ate = r.lancamentos.filter(l => l.data <= fim);
    const razao = ate.length ? ate[ate.length - 1].saldo : r.saldoInicial;
    const soma = faltam.filter(x => x.iso <= fim).reduce((s, x) => s + cent(x.efeito), 0);
    return { mes, razao: cent(razao) / 100, comLancamentos: (cent(razao) + soma) / 100 };
  });
}
