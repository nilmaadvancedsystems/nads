// A abertura do app (Vitor, 01/10/2026: "a abertura revela a logo completa", "faça alguma animação interessante"),
// refeita com o animejs (01/10/2026). Enquanto carrega:
//   0–0,8 s   as metades do N (vermelha e prata) entram de lados opostos, com mola, e se encaixam (um tranco de leve);
//   0,8–1,5 s o N desliza para a esquerda e "Nilma" se revela da esquerda para a direita, saindo do desfoque;
//   1,4–2 s   "CONTABILIDADE" abre do centro para fora;
//   depois    um brilho metálico passa pelas letras de tempos em tempos e a logo respira até a tela abrir.
// As palavras são da logo oficial, vetorizadas (logoNilma.ts): nítidas em qualquer tamanho; "Nilma" com o mesmo
// degradê vermelho do N e "CONTABILIDADE" na cor do texto (clara no escuro).
// vidro: por cima de uma área que está carregando (o fundo embaçado), só o N, que se monta e respira.
// Sem movimento (prefers-reduced-motion): a logo aparece parada, já montada.
import { animate, createTimeline } from 'animejs';
import { useLayoutEffect, useRef } from 'react';
import { MOLA_VIVA, semMovimento } from './animacao';
import { CAMINHO_N } from './icones';
import palavra from './logo-nilma-palavra.svg';
import { CAMINHO_CONTABILIDADE, CAMINHO_NILMA, VIEWBOX_CONTABILIDADE, VIEWBOX_NILMA } from './logoNilma';

function N({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 720 1176" aria-hidden="true">
      <g className="abertura-a"><path fill="url(#nlRed)" d={CAMINHO_N} /></g>
      <g className="abertura-b"><path fill="url(#nlSilver)" transform="rotate(180 360 588)" d={CAMINHO_N} /></g>
    </svg>
  );
}

/** As metades do N entram de lados opostos e encaixam (as duas abertura usam). */
// emX: onde o N está enquanto se monta (na logo completa, no meio da caixa: 176,5% à direita do lugar dele)
function montarN(tl: ReturnType<typeof createTimeline>, raiz: HTMLElement, emX = '0%') {
  const a = raiz.querySelector('.abertura-a');
  const b = raiz.querySelector('.abertura-b');
  const n = raiz.querySelector('svg');
  tl.add(a!, { opacity: [0, 1], translateX: ['-26%', '0%'], translateY: ['-16%', '0%'], rotate: [-14, 0], scale: [0.7, 1], ease: MOLA_VIVA }, 0)
    .add(b!, { opacity: [0, 1], translateX: ['26%', '0%'], translateY: ['16%', '0%'], rotate: [-14, 0], scale: [0.7, 1], ease: MOLA_VIVA }, 120)
    // o encaixe: um tranco curto quando as metades se juntam
    .add(n!, { translateX: [emX, emX], scale: [1, 1.06, 1], duration: 320, ease: 'outQuad' }, 560);
}

export function AberturaN({ vidro }: { vidro?: boolean } = {}) {
  const raiz = useRef<HTMLDivElement>(null);
  const anima = !semMovimento();

  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el || !anima) return;
    const tl = createTimeline({ autoplay: true });
    const extras: { revert(): void }[] = [];
    montarN(tl, el, vidro ? '0%' : '176.5%');
    if (vidro) {
      extras.push(animate(el.querySelector('.abertura-n')!, { scale: [1, 1.04], duration: 1200, delay: 1000, alternate: true, loop: true, ease: 'inOutSine' }));
    } else {
      tl.add(el.querySelector('.abertura-logo-n')!, { translateX: ['176.5%', '0%'], duration: 720, ease: 'inOutExpo' }, 820)
        .add(el.querySelector('.abertura-palavra')!, {
          opacity: [0.2, 1], clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], filter: ['blur(8px)', 'blur(0px)'], translateX: ['-4%', '0%'],
          duration: 760, ease: 'outExpo',
        }, 980)
        .add(el.querySelector('.abertura-contabilidade')!, {
          opacity: [0, 1], clipPath: ['inset(0% 50% 0% 50%)', 'inset(0% 0% 0% 0%)'], translateY: ['30%', '0%'], duration: 620, ease: 'outExpo',
        }, 1420);
      // o brilho metálico, de tempos em tempos
      extras.push(animate(el.querySelector('.abertura-brilho')!, {
        backgroundPosition: ['160% 0%', '-60% 0%'], duration: 1400, delay: 1750, loopDelay: 1800, loop: true, ease: 'inOutSine',
      }));
      // a logo respira até a tela abrir
      extras.push(animate(el.querySelector('.abertura-logo')!, { scale: [1, 1.02], duration: 1500, delay: 2300, alternate: true, loop: true, ease: 'inOutSine' }));
    }
    return () => { tl.revert(); extras.forEach(x => x.revert()); };
  }, [vidro, anima]);

  if (vidro) {
    return (
      <div ref={raiz} className={'abertura vidro' + (anima ? ' anima' : '')} role="status" aria-label="Abrindo">
        <N className="abertura-n" />
      </div>
    );
  }
  return (
    <div ref={raiz} className={'abertura' + (anima ? ' anima' : '')} role="status" aria-label="Abrindo">
      <div className="abertura-logo">
        <N className="abertura-logo-n" />
        <svg className="abertura-palavra" viewBox={VIEWBOX_NILMA} preserveAspectRatio="none" aria-hidden="true"><path fill="url(#nlRed)" fillRule="evenodd" d={CAMINHO_NILMA} /></svg>
        <span className="abertura-brilho" style={{ WebkitMaskImage: 'url(' + palavra + ')', maskImage: 'url(' + palavra + ')' }} />
        <svg className="abertura-contabilidade" viewBox={VIEWBOX_CONTABILIDADE} preserveAspectRatio="none" aria-hidden="true"><path fill="currentColor" fillRule="evenodd" d={CAMINHO_CONTABILIDADE} /></svg>
      </div>
    </div>
  );
}
