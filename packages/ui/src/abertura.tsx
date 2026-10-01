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
// Fase 3 (01/10/2026): antes de as metades chegarem, o contorno prateado do N se desenha (as metades pousam dentro dele).
// A abertura inteira roda no primeiro acesso do dia; nas outras vezes a logo só acende, montada (quem abre o app
// várias vezes ao dia não espera a mesma apresentação de novo).
import { animate, createDrawable, createTimeline } from 'animejs';
import { useLayoutEffect, useRef, useState } from 'react';
import { ENTRAR, GAVETA, MOLA_VIVA, semMovimento } from './animacao';

const CHAVE_DIA = 'nads-abertura-vista';
const hoje = () => new Date().toLocaleDateString('sv');
function jaViuHoje(): boolean {
  try { return localStorage.getItem(CHAVE_DIA) === hoje(); } catch { return false; }
}
function marcarVista() {
  try { localStorage.setItem(CHAVE_DIA, hoje()); } catch { /* sem storage: vê de novo */ }
}
import { CAMINHO_N } from './icones';
import palavra from './logo-nilma-palavra.svg';
import { CAMINHO_CONTABILIDADE, CAMINHO_NILMA, VIEWBOX_CONTABILIDADE, VIEWBOX_NILMA } from './logoNilma';

function N({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 720 1176" aria-hidden="true">
      <g className="abertura-contorno">
        <path fill="none" stroke="url(#nlSilver)" strokeWidth={12} strokeLinejoin="round" d={CAMINHO_N} />
        <path fill="none" stroke="url(#nlSilver)" strokeWidth={12} strokeLinejoin="round" transform="rotate(180 360 588)" d={CAMINHO_N} />
      </g>
      <g className="abertura-a"><path fill="url(#nlRed)" d={CAMINHO_N} /></g>
      <g className="abertura-b"><path fill="url(#nlSilver)" transform="rotate(180 360 588)" d={CAMINHO_N} /></g>
    </svg>
  );
}

/** As metades do N entram de lados opostos e encaixam (as duas abertura usam). */
// emX: onde o N está enquanto se monta (na logo completa, no meio da caixa: 176,5% à direita do lugar dele)
function montarN(tl: ReturnType<typeof createTimeline>, raiz: HTMLElement, emX = '0%', ini = 0) {
  const a = raiz.querySelector('.abertura-a');
  const b = raiz.querySelector('.abertura-b');
  const n = raiz.querySelector('svg');
  tl.add(a!, { opacity: [0, 1], translateX: ['-26%', '0%'], translateY: ['-16%', '0%'], rotate: [-14, 0], scale: [0.7, 1], ease: MOLA_VIVA }, ini)
    .add(b!, { opacity: [0, 1], translateX: ['26%', '0%'], translateY: ['16%', '0%'], rotate: [-14, 0], scale: [0.7, 1], ease: MOLA_VIVA }, ini + 120)
    // o encaixe: um tranco curto quando as metades se juntam
    .add(n!, { translateX: [emX, emX], scale: [1, 1.06, 1], duration: 320, ease: 'outQuad' }, ini + 560);
}

/** O contorno prateado do N se desenha (as duas metades ao mesmo tempo) e, quando elas pousam, ele se apaga. */
function desenharContorno(tl: ReturnType<typeof createTimeline>, raiz: HTMLElement, apagaEm: number) {
  const contorno = raiz.querySelector('.abertura-contorno');
  if (!contorno) return;
  const tracos = createDrawable(contorno.querySelectorAll('path') as unknown as SVGGeometryElement[]);
  tl.add(contorno, { opacity: [0, 1], duration: 160, ease: 'linear' }, 0)
    .add(tracos, { draw: ['0 0', '0 1'], duration: 640, ease: GAVETA }, 0)
    .add(contorno, { opacity: 0, duration: 360, ease: 'linear' }, apagaEm);
}

/** inteira: sempre a abertura completa (a prévia), mesmo que já tenha sido vista hoje */
export function AberturaN({ vidro, inteira }: { vidro?: boolean; inteira?: boolean } = {}) {
  const raiz = useRef<HTMLDivElement>(null);
  // a abertura inteira: só no primeiro acesso do dia (o vidro, de uma área carregando, é sempre o curto)
  const [rapida] = useState(() => !vidro && !inteira && jaViuHoje());
  const anima = !semMovimento() && !rapida;

  useLayoutEffect(() => {
    const el = raiz.current;
    // já viu hoje: a logo, montada, só acende e o brilho passa
    if (el && rapida && !semMovimento()) {
      const extras = [
        animate(el.querySelector('.abertura-logo')!, { opacity: [0, 1], scale: [0.96, 1], duration: 450, ease: ENTRAR }),
        animate(el.querySelector('.abertura-brilho')!, { backgroundPosition: ['160% 0%', '-60% 0%'], duration: 1400, delay: 300, loopDelay: 1800, loop: true, ease: 'inOutSine' }),
      ];
      return () => extras.forEach(x => x.revert());
    }
    if (!el || !anima) return;
    if (!vidro) marcarVista();
    const tl = createTimeline({ autoplay: true });
    const extras: { revert(): void }[] = [];
    // na logo completa, o contorno se desenha primeiro e as metades pousam dentro dele (250 ms depois)
    const ini = vidro ? 0 : 250;
    if (!vidro) desenharContorno(tl, el, ini + 600);
    montarN(tl, el, vidro ? '0%' : '176.5%', ini);
    if (vidro) {
      extras.push(animate(el.querySelector('.abertura-n')!, { scale: [1, 1.04], duration: 1200, delay: 1000, alternate: true, loop: true, ease: 'inOutSine' }));
    } else {
      tl.add(el.querySelector('.abertura-logo-n')!, { translateX: ['176.5%', '0%'], duration: 720, ease: 'inOutExpo' }, 980)
        .add(el.querySelector('.abertura-palavra')!, {
          opacity: [0.2, 1], clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], filter: ['blur(8px)', 'blur(0px)'], translateX: ['-4%', '0%'],
          duration: 760, ease: 'outExpo',
        }, 1140)
        .add(el.querySelector('.abertura-contabilidade')!, {
          opacity: [0, 1], clipPath: ['inset(0% 50% 0% 50%)', 'inset(0% 0% 0% 0%)'], translateY: ['30%', '0%'], duration: 620, ease: 'outExpo',
        }, 1560);
      // o brilho metálico, de tempos em tempos
      extras.push(animate(el.querySelector('.abertura-brilho')!, {
        backgroundPosition: ['160% 0%', '-60% 0%'], duration: 1400, delay: 1900, loopDelay: 1800, loop: true, ease: 'inOutSine',
      }));
      // a logo respira até a tela abrir
      extras.push(animate(el.querySelector('.abertura-logo')!, { scale: [1, 1.02], duration: 1500, delay: 2450, alternate: true, loop: true, ease: 'inOutSine' }));
    }
    return () => { tl.revert(); extras.forEach(x => x.revert()); };
  }, [vidro, anima, rapida]);

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
