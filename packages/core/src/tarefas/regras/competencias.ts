// Competências ('aaaa-mm'): as que aparecem para escolher e o rótulo delas.
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function rotuloCompetencia(c: string): string {
  return MESES[Number(c.slice(5, 7)) - 1] + '/' + c.slice(0, 4);
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
