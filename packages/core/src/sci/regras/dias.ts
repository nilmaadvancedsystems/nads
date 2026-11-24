// Os dias sem lançamento no minimum (24/11/2026: "nao deixa lançar nos sábados e feriados nacionais, use como referencia as datas
// do calendário do inicio"): o sábado e os feriados nacionais (os do calendário do Início que são de todo o país). Calculados
// para qualquer ano (o lançamento pode ser de um ano que o calendário do Início ainda não tem): os de data fixa e a Paixão de
// Cristo, dois dias antes da Páscoa. O Carnaval e o Corpus Christi são ponto facultativo: entram.

const FIXOS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '12-25': 'Natal',
};

/** O domingo de Páscoa do ano (o cálculo de Meeus/Jones/Butcher), 'aaaa-mm-dd'. */
export function pascoa(ano: number): string {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return ano + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
}

const somarDias = (iso: string, n: number) => {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
};

/** O nome do feriado nacional do dia 'aaaa-mm-dd'; null num dia comum. */
export function feriadoNacional(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ano = +iso.slice(0, 4);
  const md = iso.slice(5);
  // a Consciência Negra é feriado nacional desde 2024 (Lei 14.759/2023)
  if (md === '11-20' && ano >= 2024) return 'Consciência Negra';
  if (FIXOS[md]) return FIXOS[md];
  if (iso === somarDias(pascoa(ano), -2)) return 'Paixão de Cristo';
  return null;
}

/** Por que não se lança no dia (o sábado ou o feriado nacional); null = pode. */
export function diaSemLancamento(iso: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  if (new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))).getUTCDay() === 6) return 'sábado';
  const f = feriadoNacional(iso);
  return f ? 'feriado nacional (' + f + ')' : null;
}
