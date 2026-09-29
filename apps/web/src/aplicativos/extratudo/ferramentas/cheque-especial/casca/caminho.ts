// Onde o Cheque especial mora na URL, dentro do Extratudo: /extratudo/<código da empresa>/cheque-especial/<seção>/<página>.
import { caminhoNaFerramenta } from '../../../casca/caminho';

export { BASE } from '../../../casca/caminho';

/** Caminho dentro do Cheque especial ("<empresa>/<página…>"; sem nada = a escolha de empresa do Extratudo). */
export function caminho(resto = ''): string {
  return caminhoNaFerramenta('cheque-especial', resto);
}
