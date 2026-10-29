// A sessão que a trava do Conciliadorzinho confere (comum/trava): no site ligado ao banco (VITE_FONTE=banco), o
// login do Entregas (entregas.firestore.ts); nos exemplos, nenhuma (não há login). Os arquivos continuam só no navegador.
import type { PortaDaTrava } from '../../../comum/trava/useTrava';
import { criarSessaoEntregas } from './entregas.firestore';

const noBanco = import.meta.env.VITE_FONTE === 'banco';

let sessao: PortaDaTrava | null = null;

export function sessaoDoConciliadorzinho(): PortaDaTrava | null {
  if (!noBanco) return null;
  if (!sessao) sessao = criarSessaoEntregas();
  return sessao;
}
