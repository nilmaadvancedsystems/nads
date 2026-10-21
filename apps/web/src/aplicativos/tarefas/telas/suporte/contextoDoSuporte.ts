// De onde a pessoa está, para o balão do suporte (Vitor, 20/10/2026: "você vai pegar a tela que está aberta para o usuário,
// a empresa que ele está mexendo e qual arquivo ele quer importar"). O Executor publica aqui a empresa, os meses, a etapa,
// a aba aberta e os bancos; o balão lê. Fora do Executor, fica vazio e o balão usa o caminho da página.
import { useSyncExternalStore } from 'react';

export interface OndeEsta {
  empresa: string;
  codigo: number | null;
  meses: string[];
  /** a etapa aberta (o nome) e a aba aberta dentro dela, quando tem ("Importação" › "Bancos") */
  etapa: string;
  aba: string;
  /** os bancos da empresa, do Cadastro (o nome de cada conta) */
  bancos: string[];
}

let atual: OndeEsta | null = null;
const ouvintes = new Set<() => void>();

/** O Executor diz onde a pessoa está (null = saiu dele). */
export function publicarOndeEsta(o: OndeEsta | null) {
  if (JSON.stringify(o) === JSON.stringify(atual)) return;
  atual = o;
  for (const f of ouvintes) f();
}

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export function useOndeEsta(): OndeEsta | null {
  return useSyncExternalStore(assinar, () => atual, () => atual);
}
