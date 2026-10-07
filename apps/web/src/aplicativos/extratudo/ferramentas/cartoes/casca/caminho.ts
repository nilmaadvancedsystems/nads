// Onde o Cartões mora na URL, dentro do Extratudo: /extratudo/<código da empresa>/cartoes/<seção>/<página>.
import { caminhoNaFerramenta } from '../../../casca/caminho';

/** Caminho dentro do Cartões ("<empresa>/<página…>"; sem nada = a escolha de empresa do Extratudo). */
export function caminho(resto = ''): string {
  return caminhoNaFerramenta('cartoes', resto);
}
