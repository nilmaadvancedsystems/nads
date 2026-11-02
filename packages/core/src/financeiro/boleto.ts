// Ler o boleto (28/10/2026, Contas a pagar: "quando anexar o boleto, preencher o valor, o vencimento e a linha
// digitável sozinho"): acha no texto do PDF a linha digitável, a do boleto do banco (47 dígitos) ou a de arrecadação
// (48 dígitos, a da conta de luz, água, telefone e das guias), confere os dígitos verificadores e tira dela o valor e o
// vencimento. O vencimento do boleto do banco vem do fator (os dias desde 07/10/1997); o fator passou de 9999 em
// 21/02/2025 e recomeçou em 1000 no dia 22/02/2025 (a regra da FEBRABAN), então o mesmo fator serve a duas datas: vale a
// mais perto de hoje. A de arrecadação quase nunca traz o vencimento num lugar fixo: fica para a pessoa. Puro: sem tela.

export type TipoDeBoleto = 'bancario' | 'arrecadacao';

export interface LeituraDoBoleto {
  tipo: TipoDeBoleto;
  /** a linha digitável, só os dígitos (47 ou 48) */
  linha: string;
  /** o código de barras (44 dígitos) */
  codigoDeBarras: string;
  /** em reais; null quando o boleto não diz (valor zerado, ou a arrecadação com valor de referência) */
  valor: number | null;
  /** AAAA-MM-DD; null quando o boleto não diz (fator zerado; a arrecadação) */
  vencimento: string | null;
}

const soDigitos = (s: string) => (s || '').replace(/\D/g, '');

/** O módulo 10 (pesos 2 e 1 da direita para a esquerda; o produto acima de 9 soma os dois algarismos). */
export function modulo10(numeros: string): number {
  let soma = 0, peso = 2;
  for (let i = numeros.length - 1; i >= 0; i--) {
    const p = Number(numeros[i]) * peso;
    soma += p > 9 ? p - 9 : p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** a soma do módulo 11 (pesos 2 a 9 da direita para a esquerda, e de novo) */
function somaDoModulo11(numeros: string): number {
  let soma = 0, peso = 2;
  for (let i = numeros.length - 1; i >= 0; i--) { soma += Number(numeros[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  return soma;
}

/** O dígito geral do código de barras do banco: 11 − resto; 0, 10 e 11 viram 1. */
export function modulo11DoBanco(numeros: string): number {
  const dv = 11 - (somaDoModulo11(numeros) % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** O módulo 11 da arrecadação: resto 0 ou 1 dá 0; os outros, 11 − resto. */
export function modulo11DaArrecadacao(numeros: string): number {
  const resto = somaDoModulo11(numeros) % 11;
  return resto <= 1 ? 0 : 11 - resto;
}

const DIA = 86400000;
/** o fator 0 (o 1000 era 03/07/2000) */
const BASE_DE_1997 = Date.UTC(1997, 9, 7);
/** o fator 1000 de novo, depois do 9999 (21/02/2025) */
const BASE_DE_2025 = Date.UTC(2025, 1, 22);
const isoDe = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const msDe = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** O vencimento do fator (1000 a 9999): das duas datas que ele serve, a mais perto de hoje (AAAA-MM-DD). '' sem fator. */
export function vencimentoDoFator(fator: number, hoje: string): string {
  if (!Number.isInteger(fator) || fator < 1000 || fator > 9999) return '';
  const antigo = BASE_DE_1997 + fator * DIA;
  const novo = BASE_DE_2025 + (fator - 1000) * DIA;
  const ref = msDe(hoje);
  return isoDe(Math.abs(antigo - ref) <= Math.abs(novo - ref) ? antigo : novo);
}

/** O boleto do banco (47 dígitos): os três campos com o módulo 10, a moeda 9 (real) e o dígito geral; null se não fecha. */
export function lerLinhaDoBanco(linha: string, hoje: string): LeituraDoBoleto | null {
  const l = soDigitos(linha);
  if (l.length !== 47 || l[3] !== '9') return null;
  if (modulo10(l.slice(0, 9)) !== Number(l[9]) || modulo10(l.slice(10, 20)) !== Number(l[20]) || modulo10(l.slice(21, 31)) !== Number(l[31])) return null;
  const codigo = l.slice(0, 4) + l[32] + l.slice(33, 47) + l.slice(4, 9) + l.slice(10, 20) + l.slice(21, 31);
  if (modulo11DoBanco(codigo.slice(0, 4) + codigo.slice(5)) !== Number(codigo[4])) return null;
  const centavos = Number(l.slice(37, 47));
  const vencimento = vencimentoDoFator(Number(l.slice(33, 37)), hoje);
  return { tipo: 'bancario', linha: l, codigoDeBarras: codigo, valor: centavos ? centavos / 100 : null, vencimento: vencimento || null };
}

/** A arrecadação (48 dígitos, começa com 8): os quatro blocos e o dígito geral, no módulo 10 ou 11 (o 3º dígito diz); null se não fecha. */
export function lerLinhaDeArrecadacao(linha: string): LeituraDoBoleto | null {
  const l = soDigitos(linha);
  if (l.length !== 48 || l[0] !== '8') return null;
  const id = l[2];
  const modulo = id === '6' || id === '7' ? modulo10 : id === '8' || id === '9' ? modulo11DaArrecadacao : null;
  if (!modulo) return null;
  const blocos = [0, 1, 2, 3].map(i => l.slice(i * 12, i * 12 + 11));
  if (blocos.some((b, i) => modulo(b) !== Number(l[i * 12 + 11]))) return null;
  const codigo = blocos.join('');
  if (modulo(codigo.slice(0, 3) + codigo.slice(4)) !== Number(codigo[3])) return null;
  // 6 e 8: o valor em reais; 7 e 9: um valor de referência (quantidade, índice), que não é o que se paga
  const centavos = id === '6' || id === '8' ? Number(codigo.slice(4, 15)) : 0;
  return { tipo: 'arrecadacao', linha: l, codigoDeBarras: codigo, valor: centavos ? centavos / 100 : null, vencimento: null };
}

/** A linha digitada ou colada (com ou sem pontos e espaços): a do banco ou a de arrecadação; null se não é uma linha que fecha. */
export function lerLinhaDigitavel(linha: string, hoje: string): LeituraDoBoleto | null {
  const l = soDigitos(linha);
  return l.length === 47 ? lerLinhaDoBanco(l, hoje) : l.length === 48 ? lerLinhaDeArrecadacao(l) : null;
}

/** a linha do banco como vem impressa: 00000.00000 00000.000000 00000.000000 0 00000000000000 */
const LINHA_DO_BANCO = /(\d{5})[.\s]?(\d{5})\s+(\d{5})[.\s]?(\d{6})\s+(\d{5})[.\s]?(\d{6})\s+(\d)\s+(\d{14})/g;
/** a de arrecadação: 00000000000-0 00000000000-0 00000000000-0 00000000000-0 */
const LINHA_DE_ARRECADACAO = /(\d{11})[-\s]?(\d)\s+(\d{11})[-\s]?(\d)\s+(\d{11})[-\s]?(\d)\s+(\d{11})[-\s]?(\d)/g;

/**
 * Acha a linha digitável no texto do PDF e a lê: primeiro como ela vem impressa (os grupos com ponto e espaço), depois
 * qualquer sequência de dígitos (com pontos, traços e espaços no meio) que tenha 47 ou 48 dígitos e feche os verificadores.
 * null quando não acha.
 */
export function lerBoleto(texto: string, hoje: string): LeituraDoBoleto | null {
  const t = texto || '';
  for (const m of t.matchAll(LINHA_DO_BANCO)) { const r = lerLinhaDoBanco(m.slice(1).join(''), hoje); if (r) return r; }
  for (const m of t.matchAll(LINHA_DE_ARRECADACAO)) { const r = lerLinhaDeArrecadacao(m.slice(1).join('')); if (r) return r; }
  const trechos = (t.match(/\d[\d .-]*\d/g) || []).map(soDigitos).filter(d => d.length >= 47);
  // a sequência que tem exatamente o tamanho da linha; depois, dentro das maiores (a linha colada num número vizinho)
  for (const d of trechos) { const r = d.length <= 48 ? lerLinhaDigitavel(d, hoje) : null; if (r) return r; }
  for (const d of trechos) {
    for (let i = 0; i + 47 <= d.length; i++) {
      const r = lerLinhaDeArrecadacao(d.slice(i, i + 48)) || lerLinhaDoBanco(d.slice(i, i + 47), hoje);
      if (r) return r;
    }
  }
  return null;
}

/** A linha para mostrar, nos grupos de como vem impressa ('' se não tem 47 nem 48 dígitos). */
export function linhaFormatada(linha: string): string {
  const l = soDigitos(linha);
  if (l.length === 47) return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
  if (l.length === 48) return [0, 1, 2, 3].map(i => l.slice(i * 12, i * 12 + 11) + '-' + l[i * 12 + 11]).join(' ');
  return '';
}
