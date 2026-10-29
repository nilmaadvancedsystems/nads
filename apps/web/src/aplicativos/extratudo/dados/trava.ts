// A sessão que a trava do Extratudo confere (comum/trava): no banco, o login do Entregas (entregas.firestore.ts);
// nos exemplos, nenhuma (não há login). Dentro do Entregas (iframe), também nenhuma: a pessoa já entrou lá e o
// Entregas só mostra o Extratudo no módulo Contábil.
import type { PortaDaTrava } from '../../../comum/trava/useTrava';
import { dentroDoEntregas } from './drive.firestore';
import { criarSessaoEntregas } from './entregas.firestore';

const noBanco = import.meta.env.VITE_FONTE === 'banco';

let sessao: PortaDaTrava | null = null;

export function sessaoDoExtratudo(): PortaDaTrava | null {
  if (!noBanco || dentroDoEntregas()) return null;
  if (!sessao) sessao = criarSessaoEntregas();
  return sessao;
}
