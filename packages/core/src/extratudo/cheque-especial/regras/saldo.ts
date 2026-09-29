// Leitura do saldo.
// Origem: cheque_especial.html — roundCents (~L565) e parseSaldoCell (~L571).
// No original, parseSaldoCell lia state.invertCD; aqui a convenção vem por parâmetro.

/** Arredonda para centavos e normaliza -0 para 0 (tira o ruído de ponto flutuante do Excel). */
export function arredondarCentavos(n: number): number {
  const r = Math.round(n * 100) / 100;
  return r === 0 ? 0 : r;
}

/**
 * Número escrito em texto: "1.234,56", "1234.56", "1,234.56", "-500,00", "(500,00)", "R$ 10".
 * Com vírgula e ponto, o que vem por último é o decimal. Só vírgula: a vírgula é decimal.
 * Só ponto: "1.000" e "1.234.567" são milhar; senão ("1234.56") é decimal. Sem número: null.
 */
export function numeroDoTexto(texto: string): number | null {
  let s = texto.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  const negativo = /^-/.test(s) || /^\(.*\)$/.test(s);
  // só o sinal da frente e os parênteses de fora; '1-2' continua não sendo número
  s = s.replace(/^\((.*)\)$/, '$1').replace(/^[-+]/, '');
  const virg = s.lastIndexOf(',');
  const ponto = s.lastIndexOf('.');
  if (virg >= 0 && ponto >= 0) s = virg > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (virg >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negativo ? -n : n;
}

/**
 * Valor da célula da coluna Saldo → número (ou null = a linha é ignorada).
 * - Número: já vem com sinal (C positivo, D negativo); com `inverterCD` o sinal é trocado.
 * - Texto com sufixo C/D: o sufixo dá o sinal (C = +, D = −; ao contrário com `inverterCD`).
 * - Texto sem sufixo: vale o número como está escrito ("500,00" positivo, "-500,00" negativo),
 *   sem a convenção C/D (como no original, que só usava a convenção com a letra ou na célula numérica).
 * CORRIGIDO no nads (o original): texto sem C/D perdia o "-"; "1234.56" virava 123456; e
 * texto sem número virava saldo 0 em vez de a linha ser ignorada.
 */
export function saldoDaCelula(v: unknown, inverterCD: boolean): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? arredondarCentavos(inverterCD ? -v : v) : null;
  const texto = String(v).trim();
  const m = texto.match(/^(.*?)\s*([CD])$/i);
  if (m) {
    const n = numeroDoTexto(m[1]);
    if (n == null) return null;
    const ehC = /C/i.test(m[2]);
    const sinal = ehC ? (inverterCD ? -1 : 1) : (inverterCD ? 1 : -1);
    return arredondarCentavos(Math.abs(n) * sinal);
  }
  const n = numeroDoTexto(texto);
  if (n == null) return null;
  return arredondarCentavos(n);
}
