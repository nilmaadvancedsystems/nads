// O modo desenvolvedor (Vitor, 06/10/2026: "é livre, não grava nada no banco e são dados hipotéticos"; "deixe a aplicação
// rodar normal… estou na 292 e quero ver dados da 292"). Ligado no perfil (neste navegador), o app lê o banco de verdade
// e funciona normal, mas nada vai para o banco: a gravação (setDoc, updateDoc, deleteDoc e o commit do lote) finge que
// gravou — o que a pessoa fez fica só nesta sessão, na tela — e os pedidos que disparam ação (addDoc: e-mail, robô, IA)
// são recusados. Ficam livres só o que não altera dado: os pedidos para ler o Drive (aberturasDrive, pedidosMapaDrive) e
// o registro do login (nadsSessoes). Ligar ou desligar recarrega a página (desligado, volta tudo ao que está no banco).
// A interface fica azul (data-dev no <html>), para nunca confundir com o uso de verdade.
import { useRetorno } from '@nads/ui';
import { useEffect, useSyncExternalStore } from 'react';

const CHAVE = 'nads-modo-desenvolvedor';
const EVENTO = 'nads-modo-desenvolvedor';
export const EVENTO_BLOQUEADO = 'nads-gravacao-bloqueada';
export const MENSAGEM_BLOQUEADO = 'Modo desenvolvedor: nada foi enviado.';

/** O que pode gravar mesmo no modo desenvolvedor (não altera dado de ninguém). */
const LIVRES = [/^aberturasDrive(\/|$)/, /^pedidosMapaDrive(\/|$)/, /^nadsSessoes(\/|$)/];

export function modoDesenvolvedor(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

// a interface azul (o CSS troca o vermelho da marca pelo azul quando o <html> tem data-dev)
if (typeof document !== 'undefined') document.documentElement.toggleAttribute('data-dev', modoDesenvolvedor());

export function definirModoDesenvolvedor(ligado: boolean) {
  try { if (ligado) localStorage.setItem(CHAVE, '1'); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: não liga */ }
  window.dispatchEvent(new Event(EVENTO));
  // recarrega: o que foi feito no modo (só na tela) some, e volta tudo ao que está no banco
  window.location.reload();
}

/** O app está ligado ao banco? (o site do banco; no modo desenvolvedor também: lê de verdade, só não grava) */
export function ligadoAoBanco(): boolean {
  return import.meta.env.VITE_FONTE === 'banco';
}

function assinar(f: () => void) {
  window.addEventListener(EVENTO, f);
  window.addEventListener('storage', f);
  return () => { window.removeEventListener(EVENTO, f); window.removeEventListener('storage', f); };
}

/** O modo desenvolvedor, ao vivo (o mesmo em todas as guias e nas ferramentas dentro da Tarefa). */
export function useModoDesenvolvedor(): [boolean, (ligado: boolean) => void] {
  const ligado = useSyncExternalStore(assinar, modoDesenvolvedor, () => false);
  return [ligado, definirModoDesenvolvedor];
}

/** Grava neste caminho do banco? No modo desenvolvedor, não (só o que é livre). */
function gravaDeVerdade(caminho = ''): boolean {
  return !modoDesenvolvedor() || LIVRES.some(r => r.test(caminho));
}

const caminhoDe = (ref: unknown) => (ref && typeof ref === 'object' && 'path' in ref ? String((ref as { path: unknown }).path) : '');

/** setDoc / updateDoc / deleteDoc com a trava: no modo desenvolvedor, finge que gravou (a tela segue com o que a pessoa fez). */
export function guardar<A extends unknown[], R>(gravar: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
  return (...a: A) => (gravaDeVerdade(caminhoDe(a[0])) ? gravar(...a) : Promise.resolve(undefined as R));
}

/** addDoc com a trava: os pedidos que disparam ação (e-mail, robô, IA) são recusados no modo desenvolvedor. */
export function guardarPedido<A extends unknown[], R>(gravar: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
  return (...a: A) => {
    if (gravaDeVerdade(caminhoDe(a[0]))) return gravar(...a);
    window.dispatchEvent(new CustomEvent(EVENTO_BLOQUEADO));
    return Promise.reject(new Error(MENSAGEM_BLOQUEADO));
  };
}

/** O lote do Firestore com a trava no commit (no modo desenvolvedor, finge que gravou). */
export function guardarLote<L extends { commit: () => Promise<void> }>(lote: L): L {
  const commit = lote.commit.bind(lote);
  lote.commit = () => (gravaDeVerdade() ? commit() : Promise.resolve());
  return lote;
}

/** Na casca de cada aplicativo: quando o modo desenvolvedor recusa um pedido (e-mail, robô, IA), o aviso em cima. */
export function useAvisoDeBloqueio() {
  const { aviso } = useRetorno();
  useEffect(() => {
    let ultimo = 0;
    const f = () => {
      if (Date.now() - ultimo < 4000) return;
      ultimo = Date.now();
      aviso({ tom: 'info', titulo: 'Modo desenvolvedor', texto: 'Nada foi enviado (e-mail, robô e IA ficam parados no modo).' });
    };
    window.addEventListener(EVENTO_BLOQUEADO, f);
    return () => window.removeEventListener(EVENTO_BLOQUEADO, f);
  }, [aviso]);
}
