// Onde o Extratudo mora na URL: /extratudo/<código da empresa>/<ferramenta>/<página…>
// (ex.: /extratudo/292/extrator/conferencia/resultado, /extratudo/292/creditor/fiscal).
export const BASE = '/extratudo';

export type IdFerramenta = 'extrator' | 'cheque-especial' | 'creditor';

/**
 * Caminho dentro de uma ferramenta. `resto` vem como cada ferramenta já montava:
 * "<empresa>/<página…>" (sem nada = a escolha de empresa do Extratudo).
 */
export function caminhoNaFerramenta(ferramenta: IdFerramenta, resto = ''): string {
  if (!resto) return BASE;
  const [empresa, ...pagina] = resto.split('/');
  return BASE + '/' + empresa + '/' + ferramenta + (pagina.length ? '/' + pagina.join('/') : '');
}
