// Versão nova do nads: confere o versao.json do site (a cada 5 min e quando a aba volta a aparecer). Não mostra mais
// faixa por cima da tela (Vitor, 01/10/2026: "tá chato, deixe o usuário fechar e usar"): a casca põe um pontinho no ☰
// e, no menu, "Atualizar para 0.0.17" ao lado de "Versão do sistema". Não recarrega sozinho (podia cortar um envio no
// meio). Sem versao.json (rodando local), não faz nada. Uma conferência só para a página toda, por mais telas que usem.
import { useSyncExternalStore } from 'react';

const A_CADA_MS = 5 * 60 * 1000;

let atual = '';
let nova = '';
const ouvintes = new Set<() => void>();
let ligado = false;

function conferir() {
  fetch('/versao.json?t=' + Date.now(), { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then((j: { versao?: string } | null) => {
      const v = j?.versao && j.versao !== atual ? j.versao : '';
      if (v !== nova) { nova = v; ouvintes.forEach(f => f()); }
    })
    .catch(() => { /* sem rede ou sem o arquivo: confere na próxima */ });
}

function ligar() {
  if (ligado) return;
  ligado = true;
  conferir();
  setInterval(conferir, A_CADA_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') conferir(); });
}

/** A versão publicada, quando é outra que a desta página ('' = esta já é a mais nova, ou não deu para saber). */
export function useVersaoNova(versaoDaPagina: string): string {
  if (versaoDaPagina && !atual) atual = versaoDaPagina;
  ligar();
  return useSyncExternalStore(
    f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => nova,
    () => '',
  );
}

/** Recarrega a página na versão nova. */
export function atualizarVersao() {
  window.location.reload();
}
