// Onde o Conciliei mora na URL: /conciliei/<código da empresa>/<ferramenta>/<seção>/<página>.
import type { IdFerramenta } from './ferramentas';

export const BASE = '/conciliei';

/** Caminho dentro do Conciliei (sem nada = a escolha de empresa). */
export function caminho(resto = ''): string {
  return resto ? BASE + '/' + resto : BASE;
}

/** Caminho de uma página de uma ferramenta, na empresa aberta. */
export function caminhoDaFerramenta(rota: string, ferramenta: IdFerramenta, pagina = ''): string {
  return caminho(rota + '/' + ferramenta + (pagina ? '/' + pagina : ''));
}
