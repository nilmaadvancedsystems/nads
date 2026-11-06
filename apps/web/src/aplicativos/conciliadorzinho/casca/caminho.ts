// Onde o Conciliadorzinho mora na URL: /conciliadorzinho/<código da empresa>/conciliacao/<etapa>.
export const BASE = '/conciliadorzinho';

/** Caminho dentro do Conciliadorzinho (sem nada = a escolha de empresa). */
export function caminho(resto = ''): string {
  return resto ? BASE + '/' + resto : BASE;
}
