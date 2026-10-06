// O modo desenvolvedor (Vitor, 06/10/2026: "é livre, não grava nada no banco e são dados hipotéticos"): ligado no perfil
// (neste navegador), o app inteiro passa para os dados de exemplo (ligadoAoBanco() = falso; a página recarrega) e a pessoa
// faz o que quiser — navega por todas as etapas, o Avançar azul, o ⚡ dos dados de teste. Por segurança, a gravação no
// banco também tem a trava: as funções do
// Firestore (setDoc, addDoc, updateDoc, deleteDoc e o commit do lote) passam por guardar() em cada dados/*.firestore.ts
// e, com o modo ligado, recusam (a tela mostra o aviso). Ficam livres só o que não altera dado: os pedidos para ler o
// Drive (aberturasDrive, pedidosMapaDrive) e o registro do login (nadsSessoes). A empresa de teste (Personaly) não passa
// pelo banco: nela o desenvolvedor implanta os dados de teste (o ⚡).
import { useRetorno } from '@nads/ui';
import { useEffect, useSyncExternalStore } from 'react';

const CHAVE = 'nads-modo-desenvolvedor';
const EVENTO = 'nads-modo-desenvolvedor';
export const EVENTO_BLOQUEADO = 'nads-gravacao-bloqueada';
export const MENSAGEM_BLOQUEADO = 'Modo desenvolvedor: só ver, nada foi gravado.';

/** O que pode gravar mesmo no modo desenvolvedor (não altera dado de ninguém). */
const LIVRES = [/^aberturasDrive(\/|$)/, /^pedidosMapaDrive(\/|$)/, /^nadsSessoes(\/|$)/];

export function modoDesenvolvedor(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch { return false; }
}

export function definirModoDesenvolvedor(ligado: boolean) {
  try { if (ligado) localStorage.setItem(CHAVE, '1'); else localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: não liga */ }
  window.dispatchEvent(new Event(EVENTO));
  // os repositórios são criados uma vez: recarrega para trocar entre o banco e os dados de exemplo
  window.location.reload();
}

/** O app está ligado ao banco? (o site do banco, fora do modo desenvolvedor) */
export function ligadoAoBanco(): boolean {
  return import.meta.env.VITE_FONTE === 'banco' && !modoDesenvolvedor();
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

/** Pode gravar neste caminho do banco? No modo desenvolvedor, não (e avisa a tela). */
export function podeGravar(caminho = ''): boolean {
  if (!modoDesenvolvedor() || LIVRES.some(r => r.test(caminho))) return true;
  window.dispatchEvent(new CustomEvent(EVENTO_BLOQUEADO));
  return false;
}

const caminhoDe = (ref: unknown) => (ref && typeof ref === 'object' && 'path' in ref ? String((ref as { path: unknown }).path) : '');

/** A função de gravar do Firestore com a trava do modo desenvolvedor (o primeiro argumento é a referência). */
export function guardar<A extends unknown[], R>(gravar: (...a: A) => Promise<R>): (...a: A) => Promise<R> {
  return (...a: A) => (podeGravar(caminhoDe(a[0])) ? gravar(...a) : Promise.reject(new Error(MENSAGEM_BLOQUEADO)));
}

/** O lote do Firestore com a trava no commit. */
export function guardarLote<L extends { commit: () => Promise<void> }>(lote: L): L {
  const commit = lote.commit.bind(lote);
  lote.commit = () => (podeGravar() ? commit() : Promise.reject(new Error(MENSAGEM_BLOQUEADO)));
  return lote;
}

/** Na casca de cada aplicativo: quando o modo desenvolvedor barra uma gravação, o aviso em cima (um a cada 4 s). */
export function useAvisoDeBloqueio() {
  const { aviso } = useRetorno();
  useEffect(() => {
    let ultimo = 0;
    const f = () => {
      if (Date.now() - ultimo < 4000) return;
      ultimo = Date.now();
      aviso({ tom: 'info', titulo: 'Modo desenvolvedor', texto: 'Só ver: nada foi gravado.' });
    };
    window.addEventListener(EVENTO_BLOQUEADO, f);
    return () => window.removeEventListener(EVENTO_BLOQUEADO, f);
  }, [aviso]);
}
