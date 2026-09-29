// Onde o Creditor mora na URL: /creditor/<código da empresa>/<etapa>.
export const BASE = '/creditor';

/** Caminho dentro do Creditor (sem nada = a escolha de empresa). */
export function caminho(resto = ''): string {
  return resto ? BASE + '/' + resto : BASE;
}
