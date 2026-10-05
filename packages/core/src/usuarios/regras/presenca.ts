// Quem está online no nads (Vitor, 05/10/2026: "quero que coloque uma opção de online"): o nads aberto de cada pessoa
// grava usuarios/{uid}.nadsVistoEm a cada 3 minutos (só com a aba visível). Online = visto há menos de 5 minutos.

/** Quanto tempo sem sinal ainda conta como online (o ponto é a cada 3 min; sobra folga para um atraso). */
export const MINUTOS_ONLINE = 5;
/** De quanto em quanto tempo o nads aberto bate o ponto. */
export const PONTO_DA_PRESENCA_MS = 3 * 60 * 1000;

export function estaOnline(vistoEm: string | null | undefined, agora: Date): boolean {
  const t = vistoEm ? Date.parse(vistoEm) : NaN;
  return !isNaN(t) && agora.getTime() - t < MINUTOS_ONLINE * 60 * 1000;
}

/** "Online", "Visto há 12 min", "Visto há 3 h", "Visto há 2 dias" ou "Nunca abriu o nads". */
export function rotuloDaPresenca(vistoEm: string | null | undefined, agora: Date): string {
  const t = vistoEm ? Date.parse(vistoEm) : NaN;
  if (isNaN(t)) return 'Nunca abriu o nads';
  if (estaOnline(vistoEm, agora)) return 'Online';
  const min = Math.max(1, Math.floor((agora.getTime() - t) / 60000));
  if (min < 60) return 'Visto há ' + min + ' min';
  const h = Math.floor(min / 60);
  if (h < 24) return 'Visto há ' + h + ' h';
  const d = Math.floor(h / 24);
  return 'Visto há ' + d + (d === 1 ? ' dia' : ' dias');
}
