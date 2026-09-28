// Onde a Conferência mora na URL: /conferencia/<código da empresa>/<seção>/<página>.
export const BASE = '/conferencia';

/** Caminho dentro da Conferência (sem nada = a escolha de empresa). */
export function caminho(resto = ''): string {
  return resto ? BASE + '/' + resto : BASE;
}
