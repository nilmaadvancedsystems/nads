// Leitura de valores, datas e históricos como aparecem nos extratos e razões.
// Origem: protótipo do Extrator (leitura.js: centavos, lerData, norm, tokens, parecido).
import { normalizarTexto } from '../../../formatos';

const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };

/**
 * Valor em centavos: "1.234,56", "-1.234,56", "(10,00)", "10,00 D", "10,00 C", "10,00D" (o D/C colado, como o
 * Sicoob), "1234.56", "R$ 5,00". D, "-" ou parênteses = negativo; C ou "+" = positivo. null quando não é valor.
 */
export function centavos(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : null;
  let s = String(v == null ? '' : v).trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-|-$|(\s|\d)D$|^D\s|\(-\)/i.test(s);
  const pos = /(\s|\d)C$|\(\+\)|^\+/i.test(s);
  s = s.replace(/[()R$\s+CDcd-]/g, '');
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{1,3}(?:\.\d{3})+|\d+),(\d{1,2})$/))) s = m[1].replace(/\./g, '') + '.' + (m[2].length < 2 ? m[2] + '0' : m[2]);
  else if ((m = s.match(/^(\d{1,3}(?:,\d{3})+|\d+)\.(\d{1,2})$/))) s = m[1].replace(/,/g, '') + '.' + m[2];
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (!/^\d+$/.test(s)) return null;
  const n = Math.round(parseFloat(s) * 100);
  if (!isFinite(n)) return null;
  return neg && !pos ? -n : n;
}

/** O texto do valor já diz se é entrada ou saída (sinal, D/C, parênteses)? */
export function temSinal(v: unknown): boolean {
  return /^\(.*\)$|^-|-$|(\s|\d)[CD]$|^[CD]\s|\([+-]\)|^\+/i.test(String(v == null ? '' : v).trim());
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;

function valida(a: number, m: number, d: number): boolean {
  if (a < 1990 || a > 2100 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(a, m, 0)).getUTCDate();
}

function iso(a: number, m: number, d: number): string | null {
  return valida(a, m, d) ? a + '-' + pad(m) + '-' + pad(d) : null;
}

/**
 * Data em 'aaaa-mm-dd': "05/09/2026", "05/09/26", "05/09" (usa anoPadrao), "5 set 2026", "05-SET",
 * "2026-09-05", Date e número de série do Excel. Data que não existe (31/02) = null.
 */
export function lerData(v: unknown, anoPadrao: number): string | null {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Math.round((v - 25569) * 864e5));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = normalizarTexto(v);
  const bruto = String(v == null ? '' : v).trim();
  let m: RegExpMatchArray | null;
  if ((m = bruto.match(/^(\d{4})-(\d{2})-(\d{2})/))) return iso(+m[1], +m[2], +m[3]);
  if ((m = bruto.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/))) {
    let a = m[3] ? +m[3] : anoPadrao;
    if (a < 100) a += 2000;
    return iso(a, +m[2], +m[1]);
  }
  if ((m = s.match(/^(\d{1,2}) ?([a-z]{3})[a-z]* ?(\d{2,4})?$/)) && MESES[m[2]]) {
    let a = m[3] ? +m[3] : anoPadrao;
    if (a < 100) a += 2000;
    return iso(a, MESES[m[2]], +m[1]);
  }
  return null;
}

/** Dia corrido (para medir distância entre datas 'aaaa-mm-dd'). */
export function numeroDoDia(data: string): number {
  const p = data.split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5;
}

/** 'aaaa-mm-dd' → 'dd/mm/aaaa' */
export function dataBR(data: string): string {
  const p = data.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : data;
}

/** 'aaaa-mm-dd' → competência 'aaaa-mm' */
export function competencia(data: string): string {
  return data.slice(0, 7);
}

/** centavos → "R$ 1.234,56" (o − na frente quando negativo): o valor na tela */
export function reaisBR(c: number): string {
  return (c < 0 ? '\u2212' : '') + 'R$\u00a0' + valorBR(Math.abs(c));
}

/** centavos → "1.234,56" com "−" na frente quando negativo */
export function valorBR(c: number): string {
  const v = (Math.abs(c) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (c < 0 ? '\u2212' : '') + v;
}

// Palavras que não ajudam a dizer se dois históricos são o mesmo lançamento: conectivos e os
// verbos do banco (o extrato diz "PIX ENVIADO FORNECEDOR X", o razão "Pagamento fornecedor X").
const VAZIAS = new Set(['de', 'da', 'do', 'dos', 'das', 'para', 'com', 'por', 'ltda', 'eireli', 'cia', 'the',
  'pix', 'ted', 'doc', 'enviado', 'enviada', 'recebido', 'recebida', 'pagto', 'pagamento', 'pag', 'boleto',
  'transf', 'transferencia', 'recebimento', 'deposito', 'sispag']);

export function palavras(s: string): string[] {
  return normalizarTexto(s).split(' ').filter(t => t.length >= 3 && !VAZIAS.has(t));
}

/** 0 a 1: quantas palavras os dois históricos têm em comum (Jaccard). */
export function parecido(a: string, b: string): number {
  const A = new Set(palavras(a)), B = new Set(palavras(b));
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let comuns = 0;
  for (const t of A) if (B.has(t)) comuns++;
  return comuns / (A.size + B.size - comuns);
}
