// Onde o Conversor mora na URL: /conversor/<etapa> (no site dele, a raiz leva para cá).
export const BASE = '/conversor';

export function caminho(resto = ''): string {
  return resto ? BASE + '/' + resto : BASE;
}
