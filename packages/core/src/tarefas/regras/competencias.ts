// Competências ('aaaa-mm'): as que aparecem para escolher e o rótulo delas.
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function rotuloCompetencia(c: string): string {
  return MESES[Number(c.slice(5, 7)) - 1] + '/' + c.slice(0, 4);
}

/** O primeiro mês que o nads trabalha: as listas de competência não vão antes dele (Vitor, 30/09/2026). */
export const PRIMEIRA_COMPETENCIA = '2026-01';

/** "08/2026" (os seletores de/até e os meses do período). */
export function rotuloNumericoCompetencia(c: string): string {
  return c.slice(5, 7) + '/' + c.slice(0, 4);
}

/** O rótulo curto, para o seletor (como o "main" do GitHub): "ago 2026". */
export function rotuloCurtoCompetencia(c: string): string {
  return MESES[Number(c.slice(5, 7)) - 1].slice(0, 3).toLowerCase() + ' ' + c.slice(0, 4);
}

/** Um período na rota do executor: 'aaaa-mm' (um mês) ou 'aaaa-mm..aaaa-mm' (vários, a Etapa com vários meses). */
const PERIODO = /^(\d{4}-(0[1-9]|1[0-2]))(\.\.(\d{4}-(0[1-9]|1[0-2])))?$/;
/** No máximo 24 meses de uma vez. */
export const MAXIMO_DE_MESES = 24;

/** As competências do período, da mais velha para a mais nova ([] = não é um período válido). */
export function competenciasDoPeriodo(periodo: string): string[] {
  const m = PERIODO.exec(periodo || '');
  if (!m) return [];
  let [de, ate] = [m[1], m[4] || m[1]];
  if (de > ate) [de, ate] = [ate, de];
  const r: string[] = [];
  for (let d = new Date(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, 1); r.length < MAXIMO_DE_MESES; d.setMonth(d.getMonth() + 1)) {
    const c = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    r.push(c);
    if (c === ate) break;
  }
  return r;
}

/** O período na rota: um mês só = 'aaaa-mm'; vários = 'de..até'. */
export function rotaDoPeriodo(de: string, ate: string): string {
  const [a, b] = de <= ate ? [de, ate] : [ate, de];
  return a === b ? a : a + '..' + b;
}

/** "Agosto/2026", "Junho a Agosto/2026", "Dezembro/2025 a Fevereiro/2026". */
export function rotuloDoPeriodo(competencias: string[]): string {
  if (competencias.length <= 1) return competencias[0] ? rotuloCompetencia(competencias[0]) : '';
  const de = competencias[0], ate = competencias[competencias.length - 1];
  return de.slice(0, 4) === ate.slice(0, 4)
    ? MESES[Number(de.slice(5, 7)) - 1] + ' a ' + rotuloCompetencia(ate)
    : rotuloCompetencia(de) + ' a ' + rotuloCompetencia(ate);
}

/**
 * As últimas `n` competências, da mais nova para a mais velha, começando pelo mês ANTERIOR ao
 * de hoje (o escritório trabalha o mês que passou).
 */
export function competenciasRecentes(agora: Date, n = 12): string[] {
  const r: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    r.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return r;
}
