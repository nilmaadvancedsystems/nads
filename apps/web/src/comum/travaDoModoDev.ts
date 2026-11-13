// A trava do modo desenvolvedor sem nada do escritório (13/11/2026: "a Área do Cliente e a do robô no modo dev do nads").
// O modo é a chave 'nads-modo-desenvolvedor' deste navegador (ligada no avatar da Tarefas, modoDesenvolvedor.ts). Este
// arquivo não importa nada: entra no pacote do site da Área do Cliente sem levar o disjuntor, que fala com o banco da
// equipe. A Área do Cliente usa só o recusarNoModoDev; o resto do nads usa as travas de modoDesenvolvedor.ts (que leem daqui).
// No site do cliente a chave nunca está ligada (é outro endereço): lá a trava não muda nada.

export const CHAVE_DO_MODO_DEV = 'nads-modo-desenvolvedor';
export const EVENTO_BLOQUEADO = 'nads-gravacao-bloqueada';
export const MENSAGEM_BLOQUEADO = 'Modo desenvolvedor: nada foi enviado.';

/** O modo desenvolvedor está ligado neste navegador? */
export function modoDevLigado(): boolean {
  try { return localStorage.getItem(CHAVE_DO_MODO_DEV) === '1'; } catch { return false; }
}

/** O pedido (addDoc) que não sai no modo desenvolvedor: recusa com a mensagem do modo e avisa a tela, sem tocar no banco. */
export function recusarNoModoDev<A extends unknown[], R>(gravar: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
  return (...a: A) => {
    if (!modoDevLigado()) return gravar(...a);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENTO_BLOQUEADO));
    return Promise.reject(new Error(MENSAGEM_BLOQUEADO));
  };
}
