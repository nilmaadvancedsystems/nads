// Leitura do saldo.
// Origem: cheque_especial.html — roundCents (~L565) e parseSaldoCell (~L571).
// No original, parseSaldoCell lia state.invertCD; aqui a convenção vem por parâmetro.

/** Arredonda para centavos e normaliza -0 para 0 (tira o ruído de ponto flutuante do Excel). */
export function arredondarCentavos(n: number): number {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

/**
 * Valor da célula da coluna Saldo → número (ou null).
 * - Número: já vem com sinal (C positivo, D negativo); com `inverterCD` o sinal é trocado.
 * - Texto: sufixo C/D dá o sinal (C = +, D = −; ao contrário com `inverterCD`). Sem sufixo
 *   o valor fica POSITIVO (o "-" é descartado). Pontos são milhar e a vírgula é decimal.
 */
export function saldoDaCelula(v: unknown, inverterCD: boolean): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return arredondarCentavos(inverterCD ? -v : v);
  let s = String(v).trim();
  let sinal = 1;
  const m = s.match(/^(.*?)\s*([CD])$/i);
  if (m) {
    const ehC = /C/i.test(m[2]);
    sinal = ehC ? (inverterCD ? -1 : 1) : (inverterCD ? 1 : -1);
    s = m[1];
  }
  s = s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = Number(s);
  if (isNaN(n)) return null;
  return arredondarCentavos(Math.abs(n) * sinal);
}
