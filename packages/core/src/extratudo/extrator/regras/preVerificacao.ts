// A pré-verificação do extrato (Vitor, 10/11/2026: "extratos bancários normalmente têm saldos, datas, entradas e saídas (...)
// está ocorrendo toda vez ele puxando arquivo de fatura, aplicação, outros arquivos que não são extratos"): antes de entrar na
// etapa, o texto do arquivo diz se ele é o extrato da conta. Na dúvida, entra: tirar um extrato de verdade é pior que deixar
// passar. Os títulos são os mesmos que o arquivador do robô usa para separar os documentos (robo/arquivador-regras.js).
import { normalizarTexto } from '../../../formatos';
import type { Lancamento } from '../tipos';

export type OutroDocumento = 'fatura' | 'aplicacao' | 'emprestimo' | 'cobranca' | 'maquininha' | 'comprovante' | 'boleto' | 'nota' | 'guia' | 'sem-saldo';

export interface NaoEExtrato { tipo: OutroDocumento; motivo: string }

const MOTIVOS: Record<OutroDocumento, string> = {
  fatura: 'É a fatura do cartão, não o extrato da conta.',
  aplicacao: 'É o extrato de aplicação, não o da conta corrente.',
  emprestimo: 'É o extrato do empréstimo ou financiamento, não o da conta corrente.',
  cobranca: 'É o relatório de cobrança, não o extrato da conta.',
  maquininha: 'É o relatório da maquininha, não o extrato da conta.',
  comprovante: 'É comprovante de pagamento, não o extrato da conta.',
  boleto: 'É boleto, não o extrato da conta.',
  nota: 'É nota fiscal, não o extrato da conta.',
  guia: 'É guia de imposto, não o extrato da conta.',
  'sem-saldo': 'Não parece extrato: tem datas e valores, mas nenhum saldo da conta.',
};

const nao = (tipo: OutroDocumento): NaoEExtrato => ({ tipo, motivo: MOTIVOS[tipo] });

/** o título do extrato da conta, no topo do arquivo */
const TITULO_DE_CONTA = /extrato (?:de |da )?(?:conta|c c\b|ag\b|mensal|consolidado|unificado pessoa|por periodo|bancario|historico|financeiro)|extratomensal|extrato cc\b|conta corrente pj|lancamentos do periodo/;
/** o saldo da conta, em qualquer uma das formas dos bancos */
const SALDO_DA_CONTA = /\bs[a4]ld[o0] (?:anterior|inicial|final|d[oe] dia|dia|disponivel|em conta|atual|total|bloqueado|em \d|\d)|\bultimo saldo\b|\bsdo\b|\bsaldo r\b|\bsaldo\b.*\bsaldo\b/;
/** o movimento típico de conta corrente, no histórico de um lançamento */
const MOVIMENTO_DE_CONTA = /\b(?:pix|ted|doc|tev|tarifa|tar|boleto|cheque|chq|saque|deposito|dep|transf\w*|pagto|pagamento|pag|debito|deb|credito|cred|convenio)\b/;

/** quanto do arquivo é o "cabeçalho": o título do documento fica nele, e no resto o extrato pode citar qualquer coisa */
const TOPO = 700;

const FATURA = /fatura do cartao|resumo da fatura|extrato de cartao de credito|fatura (?:mastercard|visa|elo)|total d(?:a|esta) fatura|pagamento minimo/;
const APLICACAO = /extrato (?:de |das? )?(?:aplicac|investimento|fundos?|apropriacao diaria)|extratos? investimentos? fundos|extrato unificado de fundos|extrato detalhado por aplicacao|posicao de investimento|resumo do mes \w+ \d{4} saldo bruto|saldo bruto em|investimentos bradesco|rende facil|titulo de capitalizacao|dados do titulo/;
const EMPRESTIMO = /extrato de (?:emprestimos?|operacao de credito|financiamento)|evolucao contratual|contrato de (?:emprestimo|financiamento)|cedula de credito bancario|dados da contratacao/;
const COBRANCA = /relatorio de (?:recebimentos|cobranca)|titulos (?:liquidados|baixados)/;
const MAQUININHA = /relatorio de vendas|lista de vendas|extrato de (?:vendas|liquidacao|recebiveis)|resumo de vendas|vendas por bandeira|conciliacao de (?:vendas|recebiveis)|o que vendi/;
const COMPROVANTE = /comprovante (?:de )?(?:pagamento|transferencia|pix|agendamento|titulos|operacao|transacao|ted|doc)/;
const NOTA = /\bdanfe\b|documento auxiliar da nota fiscal|nota fiscal de servicos?|nota fiscal eletronica|\bnfs e\b/;
const GUIA = /documento de arrecadacao|guia da previdencia|\bdarf\b.*\bvencimento\b/;
const LINHA_DIGITAVEL = /\d{5}\.\d{5}\s+\d{5}\.\d{6}\s+\d{5}\.\d{6}\s+\d\s+\d{14}(?!\d)/;

/**
 * O que o arquivo é, quando não é o extrato da conta; null = pode entrar. `porOcr`: o texto do OCR pode ter perdido o saldo,
 * então a falta dele não barra (só o título do documento). O arquivo sem nenhum lançamento nem chega aqui como "sem saldo": a
 * leitura já diz que não achou nada.
 */
export function preVerificarExtrato(texto: string, lancamentos: readonly Lancamento[], porOcr = false): NaoEExtrato | null {
  const t = normalizarTexto(texto);
  const topo = t.slice(0, TOPO);
  const temSaldo = SALDO_DA_CONTA.test(t);
  // o título da conta no topo decide: o extrato pode citar a fatura, a aplicação e o comprovante. Sem saldo, segue: o comprovante
  // impresso da tela do BB traz "Consultas - Extrato de conta corrente" no cabeçalho da página
  const tituloDeConta = TITULO_DE_CONTA.test(topo);
  if (tituloDeConta && temSaldo) return null;
  if (FATURA.test(topo) && /\bvencimento\b/.test(t) && !/\bsaldo (?:anterior|inicial) (?:em|r|\d)/.test(t)) return nao('fatura');
  if (APLICACAO.test(topo)) {
    // o Extrato Consolidado (conta e fundos num PDF só) cai no título da conta; aqui, com título de aplicação, só o movimento típico de conta salva
    const deConta = lancamentos.filter(l => MOVIMENTO_DE_CONTA.test(normalizarTexto(l.historico))).length;
    if (deConta < Math.max(3, lancamentos.length * 0.3)) return nao('aplicacao');
  }
  if (EMPRESTIMO.test(topo)) return nao('emprestimo');
  if (temSaldo) return null;
  if (COBRANCA.test(topo)) return nao('cobranca');
  if (MAQUININHA.test(topo)) return nao('maquininha');
  if (COMPROVANTE.test(topo)) return nao('comprovante');
  if (LINHA_DIGITAVEL.test(texto) && /beneficiario|cedente/.test(t) && /pagador|sacado/.test(t)) return nao('boleto');
  if (NOTA.test(topo)) return nao('nota');
  if (GUIA.test(topo)) return nao('guia');
  if (!porOcr && !tituloDeConta && lancamentos.length && !/\bsaldo\b/.test(t)) return nao('sem-saldo');
  return null;
}

/** O OFX de cartão ou de investimento (a mensagem do arquivo diz qual é); o de conta corrente é STMTRS/BANKMSGSRS. */
export function preVerificarOfx(texto: string): NaoEExtrato | null {
  if (/<CCSTMTRS>|<CREDITCARDMSGSRS/i.test(texto)) return nao('fatura');
  if (/<INVSTMTRS>|<INVSTMTMSGSRS/i.test(texto)) return nao('aplicacao');
  return null;
}

/** O nome (ou a pasta) que já diz que não é o extrato da conta: nem baixa do Drive. O nome da empresa não entra aqui, só o do arquivo. */
/**
 * De qual banco é o arquivo, pelo topo do texto (o nome do banco no cabeçalho), quando dá para dizer: um banco só no topo. Os
 * nomes curtos e comuns ("caixa", "inter", "stone") só com o complemento, para o histórico de um lançamento não enganar. Na
 * 429 (Vitor, 12/11/2026: "Santander puxou o InfinityPay, Santander é esse layout"), o "Relatório de movimentações" da
 * InfinitePay (CloudWalk) entrou nos meses do Santander.
 */
const BANCO_NO_TOPO: Record<string, RegExp> = {
  infinitepay: /\binfinite ?pay\b|\binfinity ?pay\b|\bcloudwalk\b/, santander: /\bsantander\b/, itau: /\bitau\b/, bradesco: /\bbradesco\b/,
  'banco-do-brasil': /\bbanco do brasil\b/, caixa: /\bcaixa economica\b/, sicoob: /\bsicoob\b/, sicredi: /\bsicredi\b/, nubank: /\bnubank\b|\bnu pagamentos\b/,
  'mercado-pago': /\bmercado ?pago\b/, pagbank: /\bpagbank\b|\bpagseguro\b/, inter: /\bbanco inter\b/, bnb: /\bbanco do nordeste\b/,
  c6: /\bc6 ?bank\b/, btg: /\bbtg pactual\b/, safra: /\bbanco safra\b/, banrisul: /\bbanrisul\b/, cresol: /\bcresol\b/,
};
export function bancoDoTexto(texto: string): string | null {
  const topo = normalizarTexto(texto).slice(0, TOPO);
  const achados = Object.keys(BANCO_NO_TOPO).filter(id => BANCO_NO_TOPO[id].test(topo));
  return achados.length === 1 ? achados[0] : null;
}

/** O arquivo é de outro banco que não o da conta? Só quando o texto diz o banco e a conta tem a marca de um que dá para reconhecer. */
export function deOutroBanco(bancoDoArquivo: string | null | undefined, marcaDaConta: string | null | undefined): boolean {
  return !!bancoDoArquivo && !!marcaDaConta && marcaDaConta in BANCO_NO_TOPO && bancoDoArquivo !== marcaDaConta;
}

export function nomeDeOutroDocumento(nome: string): boolean {
  return /\b(?:faturas?|cartao|cartoes|aplicac\w*|aplic|investimentos?|comprovantes?|boletos?|recibos?|danfe|contrato|emprestimos?|financiamentos?|consorcio|cdb|rdc|lci|lca|fundos?)\b/.test(normalizarTexto(nome));
}
