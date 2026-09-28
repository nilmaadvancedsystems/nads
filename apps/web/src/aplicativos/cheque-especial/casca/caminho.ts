// Onde o Cheque especial mora na URL: /cheque-especial/<código da empresa>/<seção>/<página>.
export const BASE = '/cheque-especial';

/** Caminho dentro do Cheque especial (sem nada = a escolha de empresa). */
export function caminho(resto = ''): string {
  return resto ? BASE + '/' + resto : BASE;
}
