// Onde o Extrator mora na URL: /extrator/<código da empresa>/<seção>/<página>.
export const BASE = '/extrator';

/** Caminho dentro do Extrator (sem nada = a escolha de empresa). */
export function caminho(resto = ''): string {
  return resto ? BASE + '/' + resto : BASE;
}
