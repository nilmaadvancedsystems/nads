// Onde o Extrator mora na URL, dentro do Extratudo: /extratudo/<código da empresa>/extrator/<seção>/<página>.
import { caminhoNaFerramenta } from '../../../casca/caminho';

export { BASE } from '../../../casca/caminho';

/** Caminho dentro do Extrator ("<empresa>/<página…>"; sem nada = a escolha de empresa do Extratudo). */
export function caminho(resto = ''): string {
  return caminhoNaFerramenta('extrator', resto);
}
