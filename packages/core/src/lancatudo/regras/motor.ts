// O motor do Lançatudo: a regra que vale para uma linha do extrato e a chave do favorecido (para o que o nads aprende).
// Regra 'historico': a expressão no histórico do banco, sem acento e sem caixa; o * é "qualquer coisa no meio"
// ("PIX*RECEB" acha "PIX RECEBIDO JOAO"). Regra 'favorecido': todas as palavras do nome no histórico, em qualquer ordem,
// ou os dígitos do CPF/CNPJ (com ou sem pontuação). Entre várias que casam, vale a da conta bancária antes da de todas,
// e depois a de expressão mais longa (a mais específica).
import { normalizarTexto } from '../../formatos';
import type { RegraDoLancatudo, SentidoDaRegra } from '../tipos';

/** O histórico do extrato como vai no lançamento: sem o "0" solto do documento e sem espaço repetido (até 250 letras). */
export function historicoLimpo(h: string): string {
  return (h.split(/\s+/).filter(t => t && t !== '0').join(' ').trim() || h.trim()).slice(0, 250);
}

/** Os dígitos do histórico, com a pontuação de CPF/CNPJ tirada ("12.345.678/0001-90" → "12345678000190"). */
function digitosDoTexto(h: string): string {
  return h.replace(/(\d)[./-](?=\d)/g, '$1');
}

/** O CPF ou o CNPJ que aparece no histórico (11 ou 14 dígitos seguidos), ou null. */
export function documentoNoHistorico(h: string): string | null {
  const m = digitosDoTexto(h).match(/(?<!\d)(\d{14}|\d{11})(?!\d)/);
  return m ? m[1] : null;
}

/** As palavras de transação que não dizem quem é o favorecido (ficam fora da chave do que é aprendido). */
const DA_TRANSACAO = new Set([
  'pix', 'ted', 'doc', 'tef', 'transf', 'transferencia', 'enviado', 'enviada', 'recebido', 'recebida', 'emit', 'emitido', 'rec', 'receb',
  'pagamento', 'pagto', 'pgto', 'pag', 'deb', 'debito', 'cred', 'credito', 'conta', 'cc', 'para', 'de', 'do', 'da', 'dos', 'das', 'mesma',
  'titularidade', 'outra', 'outro', 'instituicao', 'banco', 'agencia', 'ag', 'internet', 'app', 'sispag', 'automatico', 'aut',
]);

/**
 * A chave do favorecido de um histórico (para a conta aprendida): o CPF/CNPJ, quando aparece; senão as palavras sem
 * número, sem as de transação ("PIX EMIT JOAO DA SILVA 123" → "joao silva"). Sem nada que sobre, o histórico inteiro sem
 * números ("TARIFA COBRANCA"). null quando o histórico não tem nenhuma palavra.
 */
export function chaveDoFavorecido(historico: string): string | null {
  const doc = documentoNoHistorico(historico);
  if (doc) return 'doc:' + doc;
  const palavras = normalizarTexto(historico).split(' ').filter(p => p && !/\d/.test(p));
  const nome = palavras.filter(p => !DA_TRANSACAO.has(p) && p.length > 1);
  const usadas = nome.length ? nome : palavras;
  return usadas.length ? 'nome:' + usadas.join(' ') : null;
}

/** A chave com o sentido (o mesmo favorecido pode ser cliente na entrada e fornecedor na saída). */
export function chaveLembrada(historico: string, valor: number): string | null {
  const k = chaveDoFavorecido(historico);
  return k ? (valor > 0 ? 'e:' : 's:') + k : null;
}

const valeNoSentido = (s: SentidoDaRegra, valor: number) => s === 'ambos' || (s === 'entrada' ? valor > 0 : valor < 0);

/** A regra casa com o histórico (sem olhar sentido nem banco)? */
export function expressaoCasa(r: Pick<RegraDoLancatudo, 'tipo' | 'expressao'>, historico: string): boolean {
  const exp = r.expressao.trim();
  if (!exp) return false;
  if (r.tipo === 'favorecido') {
    // só dígitos (o CPF/CNPJ, com ou sem pontuação): o mesmo número inteiro no histórico
    if (/^[\d\s./-]+$/.test(exp)) return (digitosDoTexto(historico).match(/\d+/g) ?? ([] as string[])).includes(exp.replace(/\D/g, ''));
    const doHist = new Set(normalizarTexto(historico).split(' '));
    const doNome = normalizarTexto(exp).split(' ').filter(Boolean);
    return doNome.length > 0 && doNome.every(p => doHist.has(p));
  }
  const texto = ' ' + normalizarTexto(historico) + ' ';
  const partes = exp.split('*').map(p => normalizarTexto(p)).filter(Boolean);
  if (!partes.length) return false;
  let de = 0;
  for (const p of partes) {
    const i = texto.indexOf(p, de);
    if (i < 0) return false;
    de = i + p.length;
  }
  return true;
}

/** A regra vale para a linha (expressão, sentido e conta bancária)? */
export function regraCasa(r: RegraDoLancatudo, linha: { historico: string; valor: number }, banco: string): boolean {
  if (r.banco && r.banco !== banco) return false;
  if (!r.conta || !valeNoSentido(r.sentido, linha.valor)) return false;
  return expressaoCasa(r, linha.historico);
}

/** A regra que vale para a linha: a da conta bancária antes da de todas; depois a de expressão mais longa. */
export function regraDaLinha(regras: readonly RegraDoLancatudo[], linha: { historico: string; valor: number }, banco: string): RegraDoLancatudo | null {
  let melhor: RegraDoLancatudo | null = null;
  for (const r of regras) {
    if (!regraCasa(r, linha, banco)) continue;
    if (!melhor || mais(r, melhor)) melhor = r;
  }
  return melhor;
}

const peso = (r: RegraDoLancatudo) => (r.banco ? 1000 : 0) + normalizarTexto(r.expressao).length;
const mais = (a: RegraDoLancatudo, b: RegraDoLancatudo) => peso(a) > peso(b) || (peso(a) === peso(b) && a.criadaEm > b.criadaEm);

/** O histórico do lançamento pela regra: o texto, e o do extrato depois quando a regra pede (sem texto, só o do extrato). */
export function historicoPelaRegra(r: Pick<RegraDoLancatudo, 'historico' | 'comHistoricoDoExtrato'>, historicoDoBanco: string): string {
  const texto = (r.historico || '').trim();
  const doBanco = historicoLimpo(historicoDoBanco);
  if (!texto) return doBanco;
  return (r.comHistoricoDoExtrato ? texto + ' ' + doBanco : texto).slice(0, 250);
}

/**
 * A regra que a tela oferece ao "Criar regra" de uma linha: o favorecido pelo CPF/CNPJ quando o histórico tem; senão o
 * texto do histórico sem números (o que muda de um mês para o outro: documento, NSU, data), no sentido da linha.
 */
export function regraSugerida(linha: { historico: string; valor: number }): Pick<RegraDoLancatudo, 'tipo' | 'expressao' | 'sentido'> {
  const sentido: SentidoDaRegra = linha.valor > 0 ? 'entrada' : 'saida';
  const doc = documentoNoHistorico(linha.historico);
  if (doc) return { tipo: 'favorecido', expressao: doc, sentido };
  const palavras = linha.historico.toUpperCase().split(/\s+/).filter(p => p && !/\d/.test(p));
  return { tipo: 'historico', expressao: palavras.join(' ').trim() || linha.historico.trim(), sentido };
}
