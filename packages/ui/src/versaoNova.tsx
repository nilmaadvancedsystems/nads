// Versão nova do nads: confere o versao.json do site (a cada 5 min e quando a aba volta a aparecer). Não mostra mais
// faixa no alto (Vitor, 01/10/2026); desde 02/10/2026 a tela trava com só o Atualizar no meio (TravaDeVersaoNova), e a casca põe um pontinho no ☰
// e, no menu, "Atualizar para 0.0.17" ao lado de "Versão do sistema". Com a pessoa usando, não recarrega sozinho; depois de
// 10 min sem uso, sim (Vitor, 09/11/2026), menos se algo estiver carregando ou gravando (podia cortar um envio no meio).
// Sem versao.json (rodando local), não faz nada. Uma conferência só para a página toda, por mais telas que usem.
import { useSyncExternalStore } from 'react';
import { algumCarregando } from './carregamento';
import { atualizarSemPerder } from './continuidade';
import { origemConfiavel, origemDoPai } from './origem';

const A_CADA_MS = 5 * 60 * 1000;
const INATIVO_MS = 10 * 60 * 1000;
const OLHAR_INATIVIDADE_MS = 30 * 1000;
const AVISAR_O_PAI_MS = 20 * 1000;
/** Quem está gravando dá preventDefault neste evento para a página não recarregar sozinha. */
const ATUALIZAR_SOZINHO = 'nads-atualizar-sozinho';
const JA_ATUALIZOU = 'nads-atualizou-sozinho';

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

let ultimoUso = Date.now();
let avisouOPai = 0;
let pai: string | null = null;

// a ferramenta dentro de uma etapa é outra página: o mouse nela não chega na de cima, então ela avisa que está em uso
function marcarUso() {
  const agora = Date.now();
  ultimoUso = agora;
  if (pai && agora - avisouOPai >= AVISAR_O_PAI_MS) { avisouOPai = agora; window.parent.postMessage({ nads: 'em-uso' }, pai); }
}

function olharInatividade() {
  if (algumCarregando() || !window.dispatchEvent(new Event(ATUALIZAR_SOZINHO, { cancelable: true }))) marcarUso();
  if (window.self !== window.top || !nova || Date.now() - ultimoUso < INATIVO_MS) return;
  // uma vez por versão: se o site ainda entregar a antiga, não fica recarregando a cada 10 min
  try { if (sessionStorage.getItem(JA_ATUALIZOU) === nova) return; sessionStorage.setItem(JA_ATUALIZOU, nova); } catch { /* segue */ }
  atualizarSemPerder();
}

/** Uma vez por página (main.tsx): saiu versão nova e a tela está há 10 min sem uso, atualiza sozinha, sem perder o que está nela. */
export function iniciarAtualizacaoPorInatividade(versaoDaPagina: string): void {
  if (!atual) atual = versaoDaPagina;
  ligar();
  pai = origemDoPai();
  for (const uso of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll']) window.addEventListener(uso, marcarUso, { capture: true, passive: true });
  window.addEventListener('message', e => { if ((e.data as { nads?: string } | null)?.nads === 'em-uso' && origemConfiavel(e.origin)) marcarUso(); });
  setInterval(olharInatividade, OLHAR_INATIVIDADE_MS);
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
