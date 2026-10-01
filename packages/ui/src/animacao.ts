// As animações do nads, com o animejs (v4). Regras da casa (a filosofia do Emil Kowalski, 01/10/2026):
//   - só transform e opacity (e clip-path/filter na abertura): nada que mexa no tamanho dos outros (sem tremer a tela);
//   - nunca de escala 0: entra de 0,95–0,97 apagado; nunca ease-in na tela (atrasa o momento que o olho está olhando);
//   - entrar: curva de saída forte (ENTRAR), 150–250 ms; janelas e gaveta até 400 ms; sair: mais rápido que entrar;
//   - o que se usa toda hora (trocar de pasta, de aba) mexe quase nada: curto e sutil, ou nada;
//   - em cascata (30–50 ms entre um e outro) quando é uma lista, e só os primeiros (lista grande não espera);
//   - quem pediu menos movimento no sistema (prefers-reduced-motion) vê menos e mais calmo: só o esmaecer, sem deslocar.
// Quem anima um elemento da tela usa animar, useEntradaAnimada (React) ou entrarEmCascata/sair (eventos).
import { animate, cleanInlineStyles, cubicBezier, spring, stagger, type AnimationParams, type JSAnimation, type TargetsParam } from 'animejs';
import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';

/** A pessoa pediu menos movimento no sistema: nada desloca, só esmaece. */
export const semMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A curva de entrar/sair da tela: rápida no começo, assenta devagar. */
export const ENTRAR = cubicBezier(0.23, 1, 0.32, 1);
/** A curva do que se move na tela de um lugar a outro. */
export const MOVER = cubicBezier(0.77, 0, 0.175, 1);
/** A curva da gaveta (a do iOS). */
export const GAVETA = cubicBezier(0.32, 0.72, 0, 1);
/** O "ease" do CSS: o aviso (toast) entra num ritmo mais elegante que o resto. */
export const SUAVE = cubicBezier(0.25, 0.1, 0.25, 1);

/** A mola da casa: chega rápido e assenta sem quicar. */
export const MOLA = spring({ mass: 1, stiffness: 170, damping: 20 });
/** Uma mola mais viva, só para o que é raro e merece festa (o N da abertura, o selo de sucesso). */
export const MOLA_VIVA = spring({ mass: 1, stiffness: 220, damping: 14 });

const DESLOCAM = ['translateX', 'translateY', 'scale', 'scaleX', 'scaleY', 'rotate', 'x', 'y'];

/**
 * animate do animejs com o menos-movimento embutido: quem pediu menos movimento vê só a opacidade (150 ms, linear);
 * sem opacidade no que anima, fica no lugar final na hora.
 */
export function animar(alvos: TargetsParam, params: AnimationParams): JSAnimation {
  if (!semMovimento()) return animate(alvos, params);
  const calmo: AnimationParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (DESLOCAM.includes(k)) continue;
    (calmo as Record<string, unknown>)[k] = v;
  }
  const temOpacidade = 'opacity' in calmo;
  return animate(alvos, { ...calmo, delay: 0, duration: temOpacidade ? 150 : 0, ease: 'linear' });
}

export interface OpcoesDeEntrada {
  /** de onde vem (px); padrão 8 */
  y?: number;
  /** escala inicial; padrão 1 (sem) */
  escala?: number;
  /** intervalo entre um e outro (ms); padrão 35 */
  intervalo?: number;
  /** espera antes do primeiro (ms) */
  atraso?: number;
  /** quanto dura cada um (ms); padrão 300 */
  duracao?: number;
  /** no máximo quantos animam (os outros já aparecem): lista grande não fica esperando; padrão 14 */
  maximo?: number;
}

/** Os elementos entram em cascata: aparecem subindo de leve. Devolve a animação (ou null sem alvos). */
export function entrarEmCascata(alvos: Element[] | NodeListOf<Element>, o: OpcoesDeEntrada = {}): JSAnimation | null {
  const lista = Array.from(alvos) as HTMLElement[];
  if (!lista.length) return null;
  const animados = lista.slice(0, o.maximo ?? 14);
  return animar(animados, {
    opacity: [0, 1],
    translateY: [o.y ?? 8, 0],
    ...(o.escala && o.escala !== 1 ? { scale: [o.escala, 1] } : {}),
    delay: stagger(o.intervalo ?? 35, { start: o.atraso ?? 0 }),
    duration: o.duracao ?? 300,
    ease: ENTRAR,
    // terminou: tira o transform que ficou no estilo (um transform, mesmo parado, prende o position:fixed dos filhos)
    onComplete: a => { cleanInlineStyles(a); },
  });
}

/**
 * React: anima a entrada do elemento (ou dos filhos que batem com o seletor) quando monta e quando as dependências
 * mudam (ex.: a pasta aberta, a aba). O estado inicial é aplicado antes de pintar (useLayoutEffect): nada pisca.
 * Saiu no meio: a animação é desfeita (o elemento fica no lugar, visível).
 */
export function useEntradaAnimada<T extends HTMLElement>(seletor: string | null, deps: DependencyList, o: OpcoesDeEntrada = {}): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    const alvos = seletor ? raiz.querySelectorAll(seletor) : [raiz];
    const a = entrarEmCascata(alvos, o);
    return () => { a?.revert(); };
    // as dependências são de quem chama (quando reanimar); o seletor e as opções são fixos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Some pelo mesmo caminho por onde entrou (desce de leve e apaga), mais rápido que a entrada; resolve quando terminou. */
export function sair(alvos: Element | Element[], o: { y?: number; escala?: number; duracao?: number } = {}): Promise<void> {
  return new Promise(resolver => {
    animar(alvos as HTMLElement | HTMLElement[], {
      opacity: 0, translateY: o.y ?? 6, ...(o.escala ? { scale: o.escala } : {}),
      duration: o.duracao ?? 160, ease: ENTRAR, onComplete: () => resolver(),
    });
  });
}
