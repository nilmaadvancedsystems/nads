// Versão nova do nads: confere o versao.json do site (a cada 5 min e quando a aba volta a aparecer). Não mostra mais
// faixa no alto (Vitor, 01/10/2026); desde 02/10/2026 a tela trava com só o Atualizar no meio (TravaDeVersaoNova), e a casca põe um pontinho no ☰
// e, no menu, "Atualizar para 0.0.17" ao lado de "Versão do sistema". Não recarrega sozinho (podia cortar um envio no
// meio). Sem versao.json (rodando local), não faz nada. Uma conferência só para a página toda, por mais telas que usem.
import { useSyncExternalStore } from 'react';
import { atualizarSemPerder } from './continuidade';

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

/** Recarrega a página na versão nova, sem perder o que está na tela (continuidade.ts). */
export function atualizarVersao() {
  atualizarSemPerder();
}

/**
 * Saiu versão nova (Vitor, 02/10/2026): a tela inteira trava, embaçada, e no meio fica só o Atualizar — que continua
 * de onde a pessoa parou (o que ela digitou e marcou volta depois). Só na página de cima (dentro das etapas, a de fora
 * já cobre tudo).
 */
export function TravaDeVersaoNova({ atual }: { atual: string }) {
  const nova = useVersaoNova(atual);
  if (!nova || window.self !== window.top) return null;
  return (
    <div className="versao-trava" role="alertdialog" aria-modal="true" aria-labelledby="versaoTravaTitulo">
      <div className="versao-trava-caixa">
        <h3 id="versaoTravaTitulo">Saiu uma versão nova</h3>
        <p className="hint">Versão {atual} → <b>{nova}</b>. Nada do que você fez na tela se perde.</p>
        <button type="button" className="btn btn-primary" autoFocus onClick={atualizarSemPerder}>Atualizar</button>
      </div>
    </div>
  );
}
