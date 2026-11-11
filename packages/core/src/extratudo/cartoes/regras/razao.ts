// O razão do cartão gerado das faturas (Vitor, 11/11/2026: "o cartão está em PDF, o razão do cartão é o que eu vou gerar"),
// no desenho do razão correto que ele mandou. A conta do cartão é de passivo:
// - a compra com nota de entrada (a nota do mesmo valor, perto da data da compra): D Fornecedor / C Cartão, "Antecipação de
//   Cartão {nota}-{CNPJ}-{fornecedor}", na data da nota; a compra parcelada entra inteira, uma vez;
// - a compra sem nota (o posto pago no cartão): D Caixa / C Cartão, na data da compra;
// - cada compra da fatura: D Cartão / C Banco no dia em que o banco pagou, com o texto do título quando tem nota
//   ("Pagamento de título nº 4706/2-…", a parcela depois do número).
// O que é de antes do período entra no dia do pagamento (como no razão correto).
import type { LinhaDeImportacao } from '../../creditor/arquivos/gerar';
import type { ItemDaFatura } from './fatura';

/** Uma nota de entrada (as linhas da mesma nota já somadas). */
export interface NotaDeEntrada {
  numero: string;
  /** CNPJ/CPF, só os números */
  doc: string;
  nome: string;
  /** 'aaaa-mm-dd' */
  data: string;
  valor: number;
  /** a conta contábil do fornecedor ('' = o relatório não trouxe) */
  conta: string;
}

/** Uma fatura: as compras e o dia em que o banco pagou ('aaaa-mm-dd'). */
export interface FaturaParaConferir { id: string; dia: string; compras: readonly ItemDaFatura[] }

/** com-nota: a nota de entrada achada; sem-nota: vai D Caixa / C Cartão; parcela-anterior: parcela de compra de antes do período. */
export type SituacaoDaCompra = 'com-nota' | 'sem-nota' | 'parcela-anterior';

export interface CompraConferida {
  fatura: string;
  item: ItemDaFatura;
  situacao: SituacaoDaCompra;
  nota: NotaDeEntrada | null;
  /** a parcela (k de n), quando a descrição traz "02/06" */
  parcela: { k: number; n: number } | null;
  /** é a primeira vez que a nota aparece (a compra parcelada credita o cartão uma vez só) */
  creditaANota: boolean;
}

const cent = (n: number) => Math.round(n * 100);
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
/** "REDECONSTRUIR 01/06 TAIOBEIRAS" → a parcela 1 de 6 */
const RE_PARCELA = /\b(\d{2})\/(\d{2})\b/;
/** a compra sem a parcela: as parcelas da mesma compra têm a mesma chave */
const chaveDaCompra = (it: ItemDaFatura) => it.data + '|' + it.descricao.replace(RE_PARCELA, '').replace(/\s+/g, ' ').trim();
const semZeros = (n: string) => n.replace(/^0+(?=\d)/, '');

/** "109-49086429000132-AUTO POSTO" (a nota, o CNPJ e o fornecedor, como no histórico do Alterdata) */
export function tituloDaNota(n: NotaDeEntrada, parcela: number | null = null): string {
  return [semZeros(n.numero) + (parcela != null ? '/' + parcela : ''), n.doc, n.nome].filter(Boolean).join('-');
}

/**
 * Cada compra das faturas × as notas de entrada: a nota do mesmo valor (parcelada: a parcela vezes as parcelas), de dez dias
 * antes da compra até cinco dias depois do pagamento. A mesma nota não serve a duas compras.
 */
export function conferirComAsNotas(faturas: readonly FaturaParaConferir[], notas: readonly NotaDeEntrada[], inicioDoPeriodo: string): CompraConferida[] {
  const usadas = new Set<NotaDeEntrada>();
  const daCompra = new Map<string, NotaDeEntrada>();
  const out: CompraConferida[] = [];
  for (const f of [...faturas].sort((a, b) => a.dia.localeCompare(b.dia))) {
    for (const it of [...f.compras].sort((a, b) => a.data.localeCompare(b.data))) {
      const p = it.descricao.match(RE_PARCELA);
      const parcela = p && Number(p[2]) > 1 ? { k: Number(p[1]), n: Number(p[2]) } : null;
      const naJanela = (n: NotaDeEntrada) => dias(n.data, it.data) >= -10 && dias(n.data, f.dia) <= 5;
      let nota: NotaDeEntrada | null = null;
      let creditaANota = false;
      let situacao: SituacaoDaCompra = 'sem-nota';
      if (it.valor > 0) {
        const chave = chaveDaCompra(it);
        const ja = parcela ? daCompra.get(chave) : undefined;
        if (ja) nota = ja;
        else {
          nota = notas.find(n => !usadas.has(n) && naJanela(n) && (parcela
            ? Math.abs(cent(n.valor) - cent(it.valor) * parcela.n) <= 5 * parcela.n
            : cent(n.valor) === cent(it.valor))) || null;
          if (nota) { usadas.add(nota); creditaANota = true; if (parcela) daCompra.set(chave, nota); }
        }
        if (nota) situacao = 'com-nota';
        else if (parcela && it.data < inicioDoPeriodo) situacao = 'parcela-anterior';
      }
      out.push({ fatura: f.id, item: it, situacao, nota, parcela, creditaANota });
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
  /** a do fornecedor cuja nota não trouxe a conta */
  fornecedorSemConta: string;
}

/** Um lançamento do razão gerado, com a data ISO (para a ordem e o saldo) e o efeito no cartão (+ crédito, − débito). */
export interface LancamentoDoCartaoAImportar { iso: string; linha: LinhaDeImportacao; efeito: number; fatura: string }

/** O razão do cartão: o crédito de cada compra (a nota ou o caixa) e o débito do pagamento. Estorno entra ao contrário. */
export function razaoDoCartao(cs: readonly CompraConferida[], diaDa: (fatura: string) => string, contas: ContasDoCartao, inicioDoPeriodo: string): LancamentoDoCartaoAImportar[] {
  const out: LancamentoDoCartaoAImportar[] = [];
  const linha = (iso: string, debito: string, credito: string, historico: string, valor: number): LinhaDeImportacao =>
    ({ automatico: '', data: dataBr(iso), debito, credito, codHistorico: '', historico, valor, documento: '' });
  // de antes do período: no dia do pagamento
  const noPeriodo = (iso: string, dia: string) => (iso >= inicioDoPeriodo ? iso : dia);
  for (const c of cs) {
    const v = Math.abs(c.item.valor);
    const gasto = c.item.valor >= 0;
    const dia = diaDa(c.fatura);
    if (c.nota && c.creditaANota) {
      const iso = noPeriodo(c.nota.data, dia);
      out.push({ iso, fatura: c.fatura, efeito: c.nota.valor, linha: linha(iso, c.nota.conta || contas.fornecedorSemConta, contas.cartao, 'Antecipação de Cartão ' + tituloDaNota(c.nota), c.nota.valor) });
    }
    if (c.situacao === 'sem-nota') {
      const iso = noPeriodo(c.item.data, dia);
      out.push({ iso, fatura: c.fatura, efeito: gasto ? v : -v, linha: linha(iso, gasto ? contas.caixa : contas.cartao, gasto ? contas.cartao : contas.caixa, c.item.descricao, v) });
    }
    const banco = contas.banco(c.fatura);
    const historico = c.nota ? 'Pagamento de título nº ' + tituloDaNota(c.nota, c.parcela ? c.parcela.k : null) : c.item.descricao;
    out.push({ iso: dia, fatura: c.fatura, efeito: gasto ? -v : v, linha: linha(dia, gasto ? contas.cartao : banco, gasto ? banco : contas.cartao, historico, v) });
  }
  return out.sort((a, b) => a.iso.localeCompare(b.iso));
}

/** O movimento do cartão em cada mês: o que entrou (compras), o que saiu (pagamentos) e o acumulado do período. */
export function movimentoDoCartao(ls: readonly LancamentoDoCartaoAImportar[], meses: readonly string[]): { mes: string; creditos: number; debitos: number; acumulado: number }[] {
  let acc = 0;
  return meses.map(mes => {
    const doMes = ls.filter(x => x.iso.slice(0, 7) === mes);
    const creditos = doMes.filter(x => x.efeito > 0).reduce((s, x) => s + cent(x.efeito), 0);
    const debitos = doMes.filter(x => x.efeito < 0).reduce((s, x) => s - cent(x.efeito), 0);
    acc += creditos - debitos;
    return { mes, creditos: creditos / 100, debitos: debitos / 100, acumulado: acc / 100 };
  });
}
