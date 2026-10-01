// As animações do nads, com o animejs (v4). Regras da casa:
//   - só transform e opacity (e clip-path/filter na abertura): nada que mexa no tamanho dos outros (sem tremer a tela);
//   - entrar: rápido e suave (mola ou outExpo, 250–450 ms); sair: mais rápido que entrar (150–220 ms);
//   - em cascata (stagger) quando é uma lista: os primeiros chegam antes, o olho acompanha;
//   - quem pediu menos movimento no sistema (prefers-reduced-motion) vê tudo parado, já no lugar.
// Quem anima um elemento da tela usa useEntrada (React) ou entrarEmCascata/sair (eventos).
import { animate, spring, stagger, type JSAnimation } from 'animejs';
import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';

/** A pessoa pediu menos movimento no sistema: nada anima. */
export const semMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A mola da casa: chega rápido e assenta sem quicar demais. */
export const MOLA = spring({ mass: 1, stiffness: 170, damping: 20 });
/** Uma mola mais viva (o que encaixa: o N da abertura, um selo). */
export const MOLA_VIVA = spring({ mass: 1, stiffness: 220, damping: 14 });

export interface OpcoesDeEntrada {
  /** de onde vem (px); padrão 10 */
  y?: number;
  /** escala inicial; padrão 1 (sem) */
  escala?: number;
  /** intervalo entre um e outro (ms); padrão 35 */
  intervalo?: number;
  /** espera antes do primeiro (ms) */
  atraso?: number;
  /** no máximo quantos animam (os outros já aparecem): lista grande não fica esperando */
  maximo?: number;
}

/** Os elementos entram em cascata: aparecem subindo de leve. Devolve a animação (ou null sem movimento). */
export function entrarEmCascata(alvos: Element[] | NodeListOf<Element>, o: OpcoesDeEntrada = {}): JSAnimation | null {
  const lista = Array.from(alvos) as HTMLElement[];
  if (!lista.length) return null;
  const maximo = o.maximo ?? 24;
  const animados = lista.slice(0, maximo);
  if (semMovimento()) return null;
  return animate(animados, {
    opacity: [0, 1],
    translateY: [o.y ?? 10, 0],
    ...(o.escala && o.escala !== 1 ? { scale: [o.escala, 1] } : {}),
    delay: stagger(o.intervalo ?? 35, { start: o.atraso ?? 0 }),
    duration: 420,
    ease: 'outExpo',
  });
}

/**
 * React: anima a entrada do elemento (ou dos filhos que batem com o seletor) quando monta e quando as dependências
 * mudam (ex.: a pasta aberta, a aba). O estado inicial é aplicado antes de pintar (useLayoutEffect): nada pisca.
 */
export function useEntrada<T extends HTMLElement>(seletor: string | null, deps: DependencyList, o: OpcoesDeEntrada = {}): RefObject<T | null> {
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

/** Some (desce de leve e apaga); resolve quando terminou. Sem movimento: na hora. */
export function sair(alvos: Element | Element[], o: { y?: number; escala?: number } = {}): Promise<void> {
  if (semMovimento()) return Promise.resolve();
  return new Promise(resolver => {
    animate(alvos as HTMLElement | HTMLElement[], {
      opacity: [1, 0], translateY: [0, o.y ?? 6], ...(o.escala ? { scale: [1, o.escala] } : {}),
      duration: 180, ease: 'inQuad', onComplete: () => resolver(),
    });
  });
}
