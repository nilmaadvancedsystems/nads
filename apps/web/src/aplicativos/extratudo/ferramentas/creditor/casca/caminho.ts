// Onde o Creditor mora na URL, dentro do Extratudo: /extratudo/<código da empresa>/creditor/<etapa>.
import { caminhoNaFerramenta } from '../../../casca/caminho';

export { BASE } from '../../../casca/caminho';

/** Caminho dentro do Creditor ("<empresa>/<página…>"; sem nada = a escolha de empresa do Extratudo). */
export function caminho(resto = ''): string {
  return caminhoNaFerramenta('creditor', resto);
}
