// As animações do nads, com o animejs (v4). Regras da casa:
//   - só transform, opacity e filter (o desfoque da marca) — nada que mexa no tamanho dos outros (sem tremer a tela);
//   - nunca de escala 0; o que se digita (busca) e o Esc não animam;
//   - quem pediu menos movimento no sistema (prefers-reduced-motion) vê só o esmaecer, sem deslocar nem desfocar.
// O JEITO (Vitor, 01/10/2026: "achei as animações muito rápidas e genéricas"): três personalidades, mais lentas e com
// cara própria; a escolhida vale para o app todo (a Prévia das animações deixa experimentar e guarda neste navegador):
//   marca  a assinatura da Nilma: as peças se revelam saindo do desfoque, como o "Nilma" da abertura (padrão)
//   viva   com mola: as peças chegam com impulso e assentam com um quique
//   suave  elegante e lenta: deslizam devagar, sem quique
// Quem anima um elemento da tela usa entrar/sairComo (eventos), useEntradaAnimada (React) ou animar.
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
/** O "ease" do CSS, para o que entra num ritmo mais calmo. */
export const SUAVE = cubicBezier(0.25, 0.1, 0.25, 1);

/** A mola da casa: chega rápido e assenta sem quicar. */
export const MOLA = spring({ mass: 1, stiffness: 170, damping: 20 });
/** Uma mola mais viva (o N da abertura, o selo de sucesso). */
export const MOLA_VIVA = spring({ mass: 1, stiffness: 220, damping: 14 });
/** Uma mola nova por animação (a mola guarda a animação dela): quique (0–1) e duração percebida (ms). */
const mola = (quique: number, duracao: number) => spring({ bounce: quique, duration: duracao });

// ------------------------------------------------------------------ o jeito
export type Jeito = 'marca' | 'viva' | 'suave';
export const JEITOS: { id: Jeito; nome: string; dica: string }[] = [
  { id: 'marca', nome: 'Marca Nilma', dica: 'As peças se revelam saindo do desfoque, como o "Nilma" da abertura.' },
  { id: 'viva', nome: 'Viva', dica: 'Com mola: chegam com impulso e assentam com um quique.' },
  { id: 'suave', nome: 'Suave', dica: 'Elegante e lenta: deslizam devagar, sem quique.' },
];
const CHAVE_JEITO = 'nads-animacao';
function lerJeito(): Jeito {
  try {
    const v = localStorage.getItem(CHAVE_JEITO);
    if (v === 'marca' || v === 'viva' || v === 'suave') return v;
  } catch { /* sem storage: o padrão */ }
  return 'marca';
}
let jeito: Jeito = typeof window === 'undefined' ? 'marca' : lerJeito();
export const jeitoAtual = (): Jeito => jeito;
/** Troca o jeito do app (vale na hora e fica guardado neste navegador). */
export function definirJeito(j: Jeito): void {
  jeito = j;
  try { localStorage.setItem(CHAVE_JEITO, j); } catch { /* vale só agora */ }
}

/** As peças que animam. */
export type Peca = 'fundo' | 'janela' | 'gaveta' | 'gavetaItens' | 'menu' | 'aviso' | 'lista' | 'pagina' | 'alerta' | 'login';
interface Receita {
  /** a entrada (de → para) */
  entra: () => AnimationParams;
  /** a saída (para onde vai) */
  sai: () => AnimationParams;
  /** em cascata: o intervalo entre um e outro (ms) e a espera antes do primeiro */
  intervalo?: number;
  atraso?: number;
}

const desfoque = (px: number) => ['blur(' + px + 'px)', 'blur(0px)'];
/** a opacidade no seu próprio tempo (com mola, ela acende antes de o movimento assentar) */
const aparece = (ms: number) => ({ from: 0, to: 1, duration: ms, ease: 'linear' as const });

const RECEITAS: Record<Jeito, Record<Peca, Receita>> = {
  marca: {
    fundo: { entra: () => ({ opacity: [0, 1], duration: 420, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 300, ease: ENTRAR }) },
    janela: {
      entra: () => ({ opacity: [0, 1], scale: [0.92, 1], translateY: [36, 0], filter: desfoque(12), duration: 650, ease: ENTRAR }),
      sai: () => ({ opacity: 0, scale: 0.95, translateY: 16, filter: 'blur(8px)', duration: 300, ease: ENTRAR }),
    },
    gaveta: { entra: () => ({ translateX: ['-100%', '0%'], duration: 640, ease: GAVETA }), sai: () => ({ translateX: '-100%', duration: 380, ease: GAVETA }) },
    gavetaItens: { entra: () => ({ opacity: [0, 1], translateX: [-28, 0], filter: desfoque(8), duration: 560, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 50, atraso: 180 },
    menu: { entra: () => ({ opacity: [0, 1], scale: [0.86, 1], filter: desfoque(8), duration: 380, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 160 }) },
    aviso: {
      entra: () => ({ opacity: [0, 1], translateY: ['120%', '0%'], scale: [0.9, 1], filter: desfoque(8), ease: mola(0.25, 700) }),
      sai: () => ({ opacity: 0, translateY: '120%', filter: 'blur(6px)', duration: 360, ease: ENTRAR }),
    },
    lista: { entra: () => ({ opacity: [0, 1], translateX: [-20, 0], filter: desfoque(6), duration: 600, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 55 },
    pagina: { entra: () => ({ opacity: [0, 1], translateY: [22, 0], filter: desfoque(10), duration: 620, ease: ENTRAR }), sai: () => ({ opacity: 0 }) },
    alerta: { entra: () => ({ opacity: [0, 1], translateY: [-14, 0], filter: desfoque(6), duration: 520, ease: ENTRAR }), sai: () => ({ opacity: 0 }) },
    login: { entra: () => ({ opacity: [0, 1], translateY: [26, 0], filter: desfoque(10), duration: 800, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 110, atraso: 100 },
  },
  viva: {
    fundo: { entra: () => ({ opacity: [0, 1], duration: 360, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 260, ease: ENTRAR }) },
    janela: {
      entra: () => ({ opacity: aparece(260), scale: [0.8, 1], translateY: [48, 0], ease: mola(0.38, 700) }),
      sai: () => ({ opacity: 0, scale: 0.88, translateY: 24, duration: 260, ease: ENTRAR }),
    },
    gaveta: { entra: () => ({ translateX: ['-100%', '0%'], ease: mola(0.22, 700) }), sai: () => ({ translateX: '-100%', duration: 320, ease: GAVETA }) },
    gavetaItens: { entra: () => ({ opacity: [0, 1], translateX: [-40, 0], ease: mola(0.4, 650) }), sai: () => ({ opacity: 0 }), intervalo: 45, atraso: 140 },
    menu: { entra: () => ({ opacity: aparece(160), scale: [0.7, 1], ease: mola(0.42, 500) }), sai: () => ({ opacity: 0, scale: 0.9, duration: 160 }) },
    aviso: {
      entra: () => ({ opacity: aparece(200), translateY: ['140%', '0%'], rotate: [-5, 0], scale: [0.85, 1], ease: mola(0.5, 750) }),
      sai: () => ({ opacity: 0, translateY: '140%', rotate: 4, duration: 320, ease: ENTRAR }),
    },
    lista: { entra: () => ({ opacity: aparece(240), translateY: [28, 0], scale: [0.96, 1], ease: mola(0.35, 650) }), sai: () => ({ opacity: 0 }), intervalo: 45 },
    pagina: { entra: () => ({ opacity: aparece(260), translateY: [30, 0], ease: mola(0.25, 650) }), sai: () => ({ opacity: 0 }) },
    alerta: { entra: () => ({ opacity: aparece(200), translateY: [-18, 0], scale: [0.95, 1], ease: mola(0.45, 600) }), sai: () => ({ opacity: 0 }) },
    login: { entra: () => ({ opacity: aparece(300), translateY: [40, 0], scale: [0.94, 1], ease: mola(0.4, 800) }), sai: () => ({ opacity: 0 }), intervalo: 90 },
  },
  suave: {
    fundo: { entra: () => ({ opacity: [0, 1], duration: 600, ease: SUAVE }), sai: () => ({ opacity: 0, duration: 380, ease: SUAVE }) },
    janela: {
      entra: () => ({ opacity: [0, 1], scale: [0.95, 1], translateY: [24, 0], duration: 700, ease: ENTRAR }),
      sai: () => ({ opacity: 0, scale: 0.97, translateY: 12, duration: 380, ease: ENTRAR }),
    },
    gaveta: { entra: () => ({ translateX: ['-100%', '0%'], duration: 800, ease: GAVETA }), sai: () => ({ translateX: '-100%', duration: 480, ease: GAVETA }) },
    gavetaItens: { entra: () => ({ opacity: [0, 1], translateX: [-16, 0], duration: 700, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 70, atraso: 240 },
    menu: { entra: () => ({ opacity: [0, 1], scale: [0.94, 1], translateY: [-8, 0], duration: 420, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 220 }) },
    aviso: { entra: () => ({ opacity: [0, 1], translateY: ['100%', '0%'], duration: 800, ease: SUAVE }), sai: () => ({ opacity: 0, translateY: '100%', duration: 480, ease: SUAVE }) },
    lista: { entra: () => ({ opacity: [0, 1], translateY: [16, 0], duration: 700, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 70 },
    pagina: { entra: () => ({ opacity: [0, 1], translateY: [16, 0], duration: 700, ease: ENTRAR }), sai: () => ({ opacity: 0 }) },
    alerta: { entra: () => ({ opacity: [0, 1], translateY: [-10, 0], duration: 600, ease: ENTRAR }), sai: () => ({ opacity: 0 }) },
    login: { entra: () => ({ opacity: [0, 1], translateY: [20, 0], duration: 900, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 130, atraso: 120 },
  },
};

/** O toque nos botões, por jeito: o quanto afunda e como volta. */
const TOQUE: Record<Jeito, { afunda: () => AnimationParams; volta: () => AnimationParams }> = {
  marca: { afunda: () => ({ scale: 0.94, duration: 140, ease: ENTRAR }), volta: () => ({ scale: 1, ease: mola(0.5, 450) }) },
  viva: { afunda: () => ({ scale: 0.9, duration: 120, ease: ENTRAR }), volta: () => ({ scale: 1, ease: mola(0.65, 550) }) },
  suave: { afunda: () => ({ scale: 0.96, duration: 220, ease: ENTRAR }), volta: () => ({ scale: 1, duration: 360, ease: ENTRAR }) },
};
export const afundar = (el: HTMLElement) => animar(el, TOQUE[jeito].afunda());
export const voltar = (el: HTMLElement) => animar(el, TOQUE[jeito].volta());

const DESLOCAM = ['translateX', 'translateY', 'scale', 'scaleX', 'scaleY', 'rotate', 'x', 'y', 'filter'];

/**
 * animate do animejs com o menos-movimento embutido: quem pediu menos movimento vê só a opacidade (200 ms, linear);
 * sem opacidade no que anima, fica no lugar final na hora.
 */
export function animar(alvos: TargetsParam, params: AnimationParams): JSAnimation {
  if (!semMovimento()) return animate(alvos, params);
  const calmo: AnimationParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (DESLOCAM.includes(k)) continue;
    (calmo as Record<string, unknown>)[k] = k === 'opacity' && v && typeof v === 'object' && 'to' in v ? [(v as { from?: number }).from ?? 0, (v as { to: number }).to] : v;
  }
  const temOpacidade = 'opacity' in calmo;
  return animate(alvos, { ...calmo, delay: 0, duration: temOpacidade ? 200 : 0, ease: 'linear' });
}

const limpar = (a: JSAnimation) => { cleanInlineStyles(a); };

/**
 * A peça entra do jeito do app (em cascata, se for mais de uma). Terminou: tira o estilo que ficou (um transform ou
 * filter parado prende o position:fixed de quem está dentro). maximo: lista grande não espera (os outros já aparecem).
 */
export function entrar(peca: Peca, alvos: Element | Element[] | NodeListOf<Element>, o: { maximo?: number; atraso?: number } = {}): JSAnimation | null {
  const lista = (alvos instanceof Element ? [alvos] : Array.from(alvos)) as HTMLElement[];
  if (!lista.length) return null;
  const r = RECEITAS[jeito][peca];
  const animados = lista.slice(0, o.maximo ?? 14);
  const atraso = (r.atraso ?? 0) + (o.atraso ?? 0);
  return animar(animados, {
    ...r.entra(),
    ...(r.intervalo && animados.length > 1 ? { delay: stagger(r.intervalo, { start: atraso }) } : atraso ? { delay: atraso } : {}),
    onComplete: limpar,
  });
}

/** A peça sai do jeito do app (pelo caminho por onde entrou, mais rápido); resolve quando terminou. */
export function sairComo(peca: Peca, alvos: Element | Element[]): Promise<void> {
  return new Promise(resolver => {
    animar(alvos as HTMLElement | HTMLElement[], { duration: 200, ease: ENTRAR, ...RECEITAS[jeito][peca].sai(), onComplete: () => resolver() });
  });
}

/**
 * React: a peça (o elemento, ou os filhos que batem com o seletor) entra quando monta e quando as dependências mudam
 * (ex.: a pasta aberta, a aba). O estado inicial é aplicado antes de pintar (useLayoutEffect): nada pisca.
 * Saiu no meio: a animação é desfeita (o elemento fica no lugar, visível).
 */
export function useEntradaAnimada<T extends HTMLElement>(seletor: string | null, deps: DependencyList, peca: Peca = 'lista', maximo?: number): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useLayoutEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    const a = entrar(peca, seletor ? raiz.querySelectorAll(seletor) : raiz, { maximo });
    return () => { a?.revert(); };
    // as dependências são de quem chama (quando reanimar); o seletor e a peça são fixos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}
