// Contas de centavo, chave da NF e datas do Creditor.
import { num } from '../../formatos';

/** Arredonda para centavos (evita 0,1 + 0,2 = 0,30000000000000004 nas somas). */
export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Iguais até o centavo. */
export function igual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

export function somar(valores: number[]): number {
  return r2(valores.reduce((s, v) => s + v, 0));
}

/**
 * Chave da NF para cruzar banco × sistema: o primeiro bloco de dígitos, sem zeros à esquerda.
 * "004521" → "4521" · "4548/2" → "4548" · "NF 4521" → "4521".
 */
export function chaveNf(nf: unknown): string {
  const m = String(nf ?? '').match(/\d+/);
  return m ? m[0].replace(/^0+(?=\d)/, '') : '';
}

/** Valor de dinheiro de planilha ou texto ("1.234,56", "R$ 1.234,56", 1234.56). */
export function dinheiro(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? r2(v) : null;
  const n = num(String(v).replace(/R\$\s*/i, '').trim());
  return n == null ? null : r2(n);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Data em DD/MM/AAAA a partir de Date, número serial do Excel ou texto ("1/9/26", "2026-09-01"). "" se não for data. */
export function dataBR(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) return pad(v.getDate()) + '/' + pad(v.getMonth() + 1) + '/' + v.getFullYear();
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return pad(d.getUTCDate()) + '/' + pad(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return pad(+m[1]) + '/' + pad(+m[2]) + '/' + (m[3].length === 2 ? '20' + m[3] : m[3]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  return '';
}

/** "01/09/2026" → 20260901, para ordenar. */
export function ordemData(d: string): number {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : 0;
}

/** Valor que o banco efetivamente creditou no título: o cobrado, ou valor + mora + outros − desconto. */
export function liquidoDoTitulo(t: { valor: number; mora: number; desconto: number; outros?: number; cobrado: number | null }): number {
  return t.cobrado != null ? t.cobrado : r2(t.valor + t.mora + (t.outros || 0) - t.desconto);
}
