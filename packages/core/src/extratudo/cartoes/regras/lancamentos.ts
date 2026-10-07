// As compras da fatura viram o razão do cartão (Vitor, 07/10/2026): um lançamento por compra, D Cartão de Crédito / C Banco,
// todos no dia em que o banco pagou a fatura. O dia vem do extrato já importado (o débito com o valor da fatura); sem
// achar, vale o vencimento, com aviso. O arquivo é o mesmo de 8 colunas do Creditor.
import type { LinhaDeImportacao } from '../../creditor/arquivos/gerar';
import type { ComprasDaFatura, FaturaDoCartao } from './fatura';

/** Uma linha do extrato do banco (o Extrator): valor em centavos, + entrada, − saída. */
export interface LinhaDoExtrato { data: string; valor: number; historico: string; banco: string }

export interface PagamentoDaFatura {
  /** 'aaaa-mm-dd' do débito no extrato */
  data: string;
  banco: string;
  historico: string;
  /** dias entre o débito e o vencimento (0 = no dia) */
  diasDoVencimento: number;
}

/** quantos dias em volta do vencimento o débito pode cair (feriado, fim de semana, débito antecipado) */
const JANELA = 10;
const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

/**
 * O débito da fatura no extrato: o valor exato do total, perto do vencimento; com mais de um, o que fala em cartão e o
 * mais perto do vencimento. null = não está no extrato importado.
 */
export function pagamentoNoExtrato(f: FaturaDoCartao, total: number, extrato: readonly LinhaDoExtrato[]): PagamentoDaFatura | null {
  const alvo = -Math.round(total * 100);
  const cartao = (h: string) => /CART|FATURA|SICOOBCARD|MASTERCARD|VISA|ELO/i.test(h);
  const achado = extrato
    .filter(l => l.valor === alvo && Math.abs(dias(l.data, f.vencimento)) <= JANELA)
    .sort((a, b) => Number(cartao(b.historico)) - Number(cartao(a.historico)) || Math.abs(dias(a.data, f.vencimento)) - Math.abs(dias(b.data, f.vencimento)))[0];
  return achado ? { data: achado.data, banco: achado.banco, historico: achado.historico, diasDoVencimento: dias(achado.data, f.vencimento) } : null;
}

const dataBr = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

/**
 * O razão: cada compra D cartão / C banco, no dia do pagamento, com a descrição da fatura no histórico. Crédito que
 * sobrou sem par (estorno) entra ao contrário (D banco / C cartão).
 */
export function lancamentosDaFatura(c: ComprasDaFatura, dia: string, contaCartao: string, contaBanco: string): LinhaDeImportacao[] {
  return c.compras.map(it => ({
    automatico: '',
    data: dataBr(dia),
    debito: it.valor >= 0 ? contaCartao : contaBanco,
    credito: it.valor >= 0 ? contaBanco : contaCartao,
    codHistorico: '',
    historico: it.descricao,
    valor: Math.abs(it.valor),
    documento: '',
  }));
}

/** "cartao_importacao_292_2026-02.xls" */
export function nomeDoArquivoDoCartao(codigoEmpresa: string | null, vencimento: string): string {
  return 'cartao_importacao' + (codigoEmpresa ? '_' + codigoEmpresa : '') + '_' + vencimento.slice(0, 7) + '.xls';
}
