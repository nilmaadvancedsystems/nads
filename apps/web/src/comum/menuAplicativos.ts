// Os aplicativos do nads na gaveta ☰ da casca, com o aberto marcado. Trocar de aplicativo leva
// à escolha de empresa dele (cada casca decide o que fazer ao sair da empresa atual).
import { APLICATIVOS } from '../inicio/aplicativos';

export function menuAplicativos(atual: string) {
  return APLICATIVOS.map(a => ({ id: a.id, nome: a.nome, icone: a.icone, ativo: a.id === atual }));
}

export function rotaDoAplicativo(id: string): string {
  return APLICATIVOS.find(a => a.id === id)?.rota ?? '/';
}
