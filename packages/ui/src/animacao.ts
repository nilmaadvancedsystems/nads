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
import { animate, cleanInlineStyles, createDrawable, cubicBezier, splitText, spring, stagger, waapi, type AnimationParams, type JSAnimation, type TargetsParam } from 'animejs';
import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';

/** A pessoa pediu menos movimento no sistema: nada desloca, só esmaece. */
// sem matchMedia (fora de um navegador de verdade: os testes) também não anima: tudo já no lugar
export const semMovimento = () => typeof window === 'undefined' || typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
/**
 * repetida: o que se faz o tempo todo (abrir pasta no Drive, o menu do botão direito) — igual em qualquer jeito, só um
 * acender rápido, sem cascata nem desfoque (o Vitor, 01/10/2026: no Drive "se repete muito, vai ficar enjoativa").
 */
export type Peca = 'fundo' | 'janela' | 'gaveta' | 'gavetaItens' | 'menu' | 'aviso' | 'lista' | 'pagina' | 'alerta' | 'login' | 'repetida' | 'menuRepetido';
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
    // a página é quase sempre uma tela cheia de caixas (listas, cartões): só um acender curto, igual nos três jeitos
    pagina: { entra: () => ({ opacity: [0, 1], translateY: [6, 0], duration: 260, ease: ENTRAR }), sai: () => ({ opacity: 0 }) },
    alerta: { entra: () => ({ opacity: [0, 1], translateY: [-14, 0], filter: desfoque(6), duration: 520, ease: ENTRAR }), sai: () => ({ opacity: 0, translateY: -8, filter: 'blur(4px)', duration: 260, ease: ENTRAR }) },
    login: { entra: () => ({ opacity: [0, 1], translateY: [26, 0], filter: desfoque(10), duration: 800, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 110, atraso: 100 },
    repetida: { entra: () => ({ opacity: [0, 1], duration: 140, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 100 }) },
    menuRepetido: { entra: () => ({ opacity: [0, 1], scale: [0.97, 1], duration: 130, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 100, ease: ENTRAR }) },
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
    pagina: { entra: () => ({ opacity: [0, 1], translateY: [6, 0], duration: 260, ease: ENTRAR }), sai: () => ({ opacity: 0 }) },
    alerta: { entra: () => ({ opacity: aparece(200), translateY: [-18, 0], scale: [0.95, 1], ease: mola(0.45, 600) }), sai: () => ({ opacity: 0, scale: 0.96, translateY: -8, duration: 240, ease: ENTRAR }) },
    login: { entra: () => ({ opacity: aparece(300), translateY: [40, 0], scale: [0.94, 1], ease: mola(0.4, 800) }), sai: () => ({ opacity: 0 }), intervalo: 90 },
    repetida: { entra: () => ({ opacity: [0, 1], duration: 140, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 100 }) },
    menuRepetido: { entra: () => ({ opacity: [0, 1], scale: [0.97, 1], duration: 130, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 100, ease: ENTRAR }) },
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
    pagina: { entra: () => ({ opacity: [0, 1], translateY: [6, 0], duration: 300, ease: ENTRAR }), sai: () => ({ opacity: 0 }) },
    alerta: { entra: () => ({ opacity: [0, 1], translateY: [-10, 0], duration: 600, ease: ENTRAR }), sai: () => ({ opacity: 0, translateY: -6, duration: 360, ease: ENTRAR }) },
    login: { entra: () => ({ opacity: [0, 1], translateY: [20, 0], duration: 900, ease: ENTRAR }), sai: () => ({ opacity: 0 }), intervalo: 130, atraso: 120 },
    repetida: { entra: () => ({ opacity: [0, 1], duration: 140, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 100 }) },
    menuRepetido: { entra: () => ({ opacity: [0, 1], scale: [0.97, 1], duration: 130, ease: ENTRAR }), sai: () => ({ opacity: 0, duration: 100, ease: ENTRAR }) },
  },
};

/**
 * O toque nos botões, por jeito: o quanto afunda e como volta. Vai pelo WAAPI na propriedade CSS `scale` (fora da
 * thread principal: não engasga quando a tela está ocupada) e soma com o transform que o botão já tenha.
 */
const TOQUE: Record<Jeito, { afunda: [number, number]; volta: () => string | ReturnType<typeof mola>; voltaMs?: number }> = {
  marca: { afunda: [0.95, 140], volta: () => mola(0.45, 420) },
  viva: { afunda: [0.91, 120], volta: () => mola(0.6, 520) },
  suave: { afunda: [0.97, 200], volta: () => 'cubic-bezier(0.23, 1, 0.32, 1)', voltaMs: 360 },
};
export function afundar(el: HTMLElement): void {
  if (semMovimento()) return;
  const [escala, ms] = TOQUE[jeito].afunda;
  waapi.animate(el, { scale: escala, duration: ms, ease: 'cubic-bezier(0.23, 1, 0.32, 1)' });
}
export function voltar(el: HTMLElement): void {
  if (semMovimento()) return;
  const t = TOQUE[jeito];
  void waapi.animate(el, { scale: 1, ease: t.volta(), ...(t.voltaMs ? { duration: t.voltaMs } : {}) })
    .then(() => { el.style.removeProperty('scale'); });
}

/** O aviso (toast) que acabou de chegar sobe de baixo, do jeito do app (em px: a pilha também é em px). */
export function paramsDoAvisoQueChega(altura: number): AnimationParams {
  const y = altura + 24;
  if (jeito === 'viva') return { opacity: aparece(200), translateY: [y, 0], scale: [0.85, 1], rotate: [-4, 0], ease: mola(0.5, 750) };
  if (jeito === 'suave') return { opacity: [0, 1], translateY: [y, 0], scale: 1, duration: 800, ease: SUAVE };
  return { opacity: [0, 1], translateY: [y, 0], scale: [0.9, 1], filter: desfoque(8), ease: mola(0.25, 700) };
}
/** Os avisos se rearrumando na pilha (chegou um, saiu um, o mouse abriu o leque). */
export function paramsDaPilha(): AnimationParams {
  return jeito === 'suave' ? { duration: 600, ease: ENTRAR } : jeito === 'viva' ? { ease: mola(0.3, 600) } : { ease: mola(0.12, 520) };
}

/** O indicador que desliza (aba ativa, item ativo da lateral, opção do segmentado), por jeito. */
const INDICADOR: Record<Jeito, () => AnimationParams> = {
  marca: () => ({ ease: mola(0.18, 520) }),
  viva: () => ({ ease: mola(0.4, 600) }),
  suave: () => ({ duration: 560, ease: MOVER }),
};
/** Leva o indicador até o lugar (left/top/largura/altura); na primeira vez, aparece já no lugar. */
export function moverIndicador(el: HTMLElement, lugar: { x: number; y: number; w: number; h: number }, primeira: boolean): void {
  const alvo = { translateX: lugar.x, translateY: lugar.y, width: lugar.w, height: lugar.h };
  if (primeira || semMovimento()) { animate(el, { ...alvo, opacity: 1, duration: 0 }); return; }
  animate(el, { ...alvo, opacity: 1, ...INDICADOR[jeito](), composition: 'replace' });
}

/**
 * Conta do número que está na tela (atual.v) até o novo, escrevendo no elemento no formato que a tela deu (os números
 * do painel). atual.v acompanha a conta: interrompida no meio, a próxima parte de onde parou.
 */
export function contar(el: HTMLElement, atual: { v: number }, para: number, formatar: (n: number) => string): JSAnimation | null {
  if (semMovimento() || atual.v === para) { atual.v = para; el.textContent = formatar(para); return null; }
  return animate(atual, {
    v: para, duration: jeito === 'suave' ? 1100 : 900, ease: jeito === 'viva' ? mola(0.2, 900) : ENTRAR,
    onUpdate: () => { el.textContent = formatar(atual.v); },
    onComplete: () => { el.textContent = formatar(para); },
  });
}

/** "R$ 1.234,56", "58%", "1.200": o número e o que vem antes e depois (pt-BR). Outra coisa (datas, códigos): null. */
export function lerNumero(texto: string): { valor: number; casas: number; antes: string; depois: string } | null {
  const m = /^([^\d-]*?)(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?)([^\d]*)$/.exec(texto.trim());
  if (!m || /[\d/:]/.test(m[1] + m[3])) return null;
  const casas = m[2].includes(',') ? m[2].split(',')[1].length : 0;
  return { valor: parseFloat(m[2].replace(/\./g, '').replace(',', '.')), casas, antes: m[1], depois: m[3] };
}

/**
 * React: um número que conta quando muda (e ao aparecer). O span é só do animejs (o React não mexe no texto dele).
 * Texto que não é número aparece como está.
 */
export function useNumeroAnimado(texto: string): RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement | null>(null);
  const atual = useRef({ v: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const n = lerNumero(texto);
    if (!n) { el.textContent = texto; return; }
    const fmt = (x: number) => n.antes + x.toLocaleString('pt-BR', { minimumFractionDigits: n.casas, maximumFractionDigits: n.casas }) + n.depois;
    const a = contar(el, atual.current, n.valor, fmt);
    return () => { a?.pause(); };
  }, [texto]);
  return ref;
}

/**
 * React: um indicador que desliza até o item ativo (o sublinhado da aba, a barrinha da lateral, o fundo da opção do
 * segmentado). O container precisa da classe com-indicador (position:relative) e o CSS do indicador é da classe dada.
 * Na primeira vez (e quando a janela muda de tamanho) ele aparece já no lugar; depois, desliza com o jeito do app.
 */
export type FormaDoIndicador = 'fundo' | 'sublinhado' | 'barra';
export function useIndicador<T extends HTMLElement>(seletorAtivo: string, deps: DependencyList, forma: FormaDoIndicador = 'fundo', classe = 'indicador'): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const primeira = useRef(true);
  const posicionar = (sem: boolean) => {
    const raiz = ref.current;
    if (!raiz) return;
    let ind = raiz.querySelector<HTMLElement>(':scope > .' + classe);
    if (!ind) {
      ind = document.createElement('span');
      ind.className = classe + ' indicador-' + forma;
      ind.setAttribute('aria-hidden', 'true');
      raiz.appendChild(ind);
    }
    const ativo = raiz.querySelector<HTMLElement>(seletorAtivo);
    if (!ativo) { ind.style.opacity = '0'; primeira.current = true; return; }
    const x = ativo.offsetLeft, y = ativo.offsetTop, w = ativo.offsetWidth, h = ativo.offsetHeight;
    // fundo: a caixa inteira; sublinhado: 2 px embaixo (a aba); barra: 4 px à esquerda, fora do item (a lateral)
    const lugar = forma === 'sublinhado' ? { x, y: y + h - 1, w, h: 2 } : forma === 'barra' ? { x: x - 8, y: y + 6, w: 4, h: h - 12 } : { x, y, w, h };
    moverIndicador(ind, lugar, sem || primeira.current);
    primeira.current = false;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { posicionar(false); }, deps);
  useLayoutEffect(() => {
    const raiz = ref.current;
    if (!raiz || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(() => posicionar(true));
    obs.observe(raiz);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/** O check se desenha (o traço vai de uma ponta à outra), com o selo crescendo junto. */
export function desenharCheck(svg: SVGSVGElement, atraso = 0): void {
  if (semMovimento()) return;
  const caminhos = svg.querySelectorAll('path, polyline, circle');
  if (!caminhos.length) return;
  const desenhos = createDrawable(caminhos as unknown as SVGGeometryElement[]);
  animate(desenhos, { draw: ['0 0', '0 1'], duration: jeito === 'suave' ? 620 : 480, delay: atraso, ease: MOVER,
    onComplete: a => { cleanInlineStyles(a); } });
}

/**
 * A festa do que é raro (tudo pronto, conferido, tudo bate): o selo encaixa com mola, o check se desenha e faíscas
 * vermelhas e prateadas (as cores do N) saem dele. faiscas=false: só o selo e o check (o sucesso do dia a dia).
 */
export function celebrar(svg: SVGSVGElement, faiscas = true): void {
  if (semMovimento()) return;
  animate(svg, { opacity: [0, 1], scale: [0.4, 1], rotate: [-30, 0], ease: MOLA_VIVA });
  desenharCheck(svg, 120);
  if (!faiscas) return;
  const r = svg.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const total = 16;
  for (let i = 0; i < total; i++) {
    const f = document.createElement('span');
    f.className = 'faisca' + (i % 2 ? ' prata' : '');
    f.setAttribute('aria-hidden', 'true');
    f.style.left = cx - 3 + 'px';
    f.style.top = cy - 3 + 'px';
    document.body.appendChild(f);
    const angulo = (i / total) * Math.PI * 2 + Math.random() * 0.4;
    const longe = 46 + Math.random() * 46;
    animate(f, {
      translateX: [0, Math.cos(angulo) * longe], translateY: [0, Math.sin(angulo) * longe], scale: [1.2, 0.3], opacity: [1, 0],
      duration: 760 + Math.random() * 260, delay: 160 + i * 8, ease: 'out(3)', onComplete: () => f.remove(),
    });
  }
}

/**
 * O título da página se revela palavra por palavra, subindo de trás de uma máscara (a assinatura da marca).
 * Devolve o desfazer (o texto volta a ser só texto). O elemento precisa de key={texto} no React.
 */
export function revelarTitulo(el: HTMLElement): (() => void) | null {
  if (semMovimento() || !el.textContent?.trim()) return null;
  const partes = splitText(el, { words: { wrap: 'clip' } });
  const a = animate(partes.words, {
    translateY: ['105%', '0%'], ...(jeito === 'marca' ? { filter: desfoque(4) } : {}),
    duration: jeito === 'suave' ? 900 : 720, delay: stagger(jeito === 'suave' ? 70 : 50), ease: jeito === 'viva' ? mola(0.3, 700) : ENTRAR,
  });
  return () => { a.revert(); partes.revert(); };
}

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

// As entradas de página que estão rodando: enquanto a página sobe, um transform fica nela, e um transform prende o
// position:fixed de quem está dentro (uma janela abriria fora do lugar). Abriu uma janela, um menu ou uma faixa fixa:
// a entrada da página termina na hora (encerrarPaginas, chamado pelo animador).
const paginas = new Set<JSAnimation>();
export function encerrarPaginas(): void {
  for (const a of paginas) { a.complete(); cleanInlineStyles(a); }
  paginas.clear();
}

/**
 * A peça entra do jeito do app (em cascata, se for mais de uma). Terminou: tira o estilo que ficou (um transform ou
 * filter parado prende o position:fixed de quem está dentro). maximo: lista grande não espera (os outros já aparecem).
 */
export function entrar(peca: Peca, alvos: Element | Element[] | NodeListOf<Element>, o: { maximo?: number; atraso?: number; mais?: AnimationParams } = {}): JSAnimation | null {
  const lista = (alvos instanceof Element ? [alvos] : Array.from(alvos)) as HTMLElement[];
  if (!lista.length) return null;
  const r = RECEITAS[jeito][peca];
  const animados = lista.slice(0, o.maximo ?? 24);
  const atraso = (r.atraso ?? 0) + (o.atraso ?? 0);
  // a cascata inteira cabe em ~600 ms: lista grande encurta o intervalo em vez de fazer o último esperar
  const intervalo = r.intervalo && animados.length > 1 ? Math.min(r.intervalo, 600 / (animados.length - 1)) : 0;
  const a = animar(animados, {
    ...r.entra(),
    ...o.mais,
    ...(intervalo ? { delay: stagger(intervalo, { start: atraso }) } : atraso ? { delay: atraso } : {}),
    onComplete: x => { paginas.delete(x); limpar(x); },
  });
  if (peca === 'pagina') paginas.add(a);
  return a;
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

/**
 * React: as linhas de uma tabela que se rearrumam (ordenar, filtrar, chegou ou saiu uma) deslizam até o lugar novo
 * em vez de pular (FLIP: guarda onde cada linha estava, mede onde ficou e anima a diferença com `translate`, pelo
 * WAAPI). As linhas novas entram em cascata. Cada linha precisa de data-linha (o id); `ordem` são os ids na ordem
 * da tela. `quieto`: o que muda pelo teclado (a busca) — mudou, as linhas vão para o lugar sem animar.
 * (O AutoLayout do animejs põe position:absolute nos filhos e quebra <table>: por isso o FLIP é feito aqui.)
 */
export function useLinhasQueSeMovem<T extends HTMLElement>(ordem: string, quieto = ''): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const antes = useRef<Map<string, number> | null>(null);
  const textos = useRef<Map<string, string>>(new Map());
  const quietoAntes = useRef(quieto);
  // a linha que mudou sozinha (o banco atualizou: a etapa andou, o e-mail foi ligado): o fundo acende e apaga devagar,
  // para o olho achar o que mudou — sem reanimar a lista. Roda a cada render, mas só lê o texto das linhas.
  useLayoutEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    const vistos = textos.current;
    const novo = new Map<string, string>();
    for (const tr of Array.from(raiz.querySelectorAll<HTMLElement>('tbody > tr[data-linha]'))) {
      const id = tr.dataset.linha || '';
      const t = tr.textContent || '';
      novo.set(id, t);
      const era = vistos.get(id);
      if (era !== undefined && era !== t && !semMovimento()) {
        tr.querySelectorAll('td').forEach(td => td.animate(
          [{ backgroundColor: 'var(--accent-soft)' }, { backgroundColor: 'var(--accent-soft)', offset: 0.25 }, { backgroundColor: 'transparent' }],
          { duration: 1400, easing: 'ease-out' }));
      }
    }
    textos.current = novo;
  });
  useLayoutEffect(() => {
    const raiz = ref.current;
    if (!raiz) return;
    const linhas = Array.from(raiz.querySelectorAll<HTMLElement>('tbody > tr[data-linha]'));
    const agora = new Map(linhas.map(tr => [tr.dataset.linha || '', tr.offsetTop] as [string, number]));
    const eram = antes.current;
    const digitou = quietoAntes.current !== quieto;
    antes.current = agora;
    quietoAntes.current = quieto;
    if (!eram || !eram.size || digitou || semMovimento()) return;
    const novas: HTMLElement[] = [];
    const ms = jeito === 'suave' ? 700 : 520;
    for (const tr of linhas) {
      const y0 = eram.get(tr.dataset.linha || '');
      if (y0 === undefined) { novas.push(tr); continue; }
      const dy = y0 - tr.offsetTop;
      if (Math.abs(dy) < 1) continue;
      void waapi.animate(tr, { translate: ['0px ' + dy + 'px', '0px 0px'], duration: ms, ease: jeito === 'viva' ? mola(0.25, 600) : 'cubic-bezier(0.77, 0, 0.175, 1)' })
        .then(() => { tr.style.removeProperty('translate'); });
    }
    if (novas.length && novas.length < linhas.length) entrar('repetida', novas);
  }, [ordem, quieto]);
  return ref;
}

// ------------------------------------------------------------------ a origem das telas flutuantes
// Toda tela flutuante (janela, menu, menu do botão direito) nasce de onde foi aberta — o botão, a linha, o ponto do
// clique direito — e, ao fechar (no × ou clicando fora), volta para lá encolhendo até o tamanho dele (o Vitor,
// 01/10/2026: "quando eu clique para fechar uma tela flutuante, ou clique fora, ela volte para onde foi aberta").
// O animador marca a origem no clique (marcarOrigem); a tela que abre logo depois (até 900 ms) fica com ela.
export interface Origem {
  el?: Element;
  ponto?: { x: number; y: number };
  /** a linha da lista (data-linha): se a lista se redesenhar (a janela do cadastro muda a rota), acha a linha nova */
  linha?: string;
  /** onde estava no clique: o último recurso, se não der para achar o botão de novo */
  lugar?: { x: number; y: number; w: number; h: number };
  /** quem a tela diz que é a casa dela (data-volta-para, um seletor): a linha da empresa, a do e-mail */
  seletor?: string;
}
let ultimaOrigem: { o: Origem; quando: number } | null = null;
const origens = new WeakMap<Element, Origem>();
export function marcarOrigem(o: Origem): void {
  if (o.el) {
    o.linha = o.el.closest<HTMLElement>('[data-linha]')?.dataset.linha;
    const r = o.el.getBoundingClientRect();
    o.lugar = { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  }
  ultimaOrigem = { o, quando: performance.now() };
}
/** A tela que acabou de abrir fica com a origem do último clique (se foi agora há pouco). */
export function pegarOrigem(tela: Element): Origem | null {
  const u = ultimaOrigem;
  ultimaOrigem = null;
  if (!u || performance.now() - u.quando > 1500) return null;
  origens.set(tela, u.o);
  return u.o;
}
/** A origem da tela: a do clique que a abriu; sem clique (aberta por link), a casa que ela mesma diz (data-volta-para). */
export const origemDe = (tela: Element): Origem | null => {
  const o = origens.get(tela);
  const seletor = (tela as HTMLElement).dataset?.voltaPara;
  if (o) return seletor ? { ...o, seletor } : o;
  return seletor ? { seletor } : null;
};

type Caixa = { x: number; y: number; w: number; h: number };
function caixaDe(el: Element): Caixa { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
/** Onde está a origem agora (o botão pode ter saído da tela: aí não tem para onde voltar). */
function lugarDaOrigem(o: Origem | null): Caixa | null {
  if (!o) return null;
  const visivel = (el: Element | null | undefined) => { if (!el?.isConnected) return null; const c = caixaDe(el); return c.w > 0 && c.h > 0 ? c : null; };
  const direto = visivel(o.el);
  if (direto) return direto;
  // a lista foi redesenhada: a mesma linha, agora outro elemento
  if (o.linha) {
    const nova = visivel(document.querySelector('[data-linha="' + CSS.escape(o.linha) + '"]'));
    if (nova) return nova;
  }
  if (o.seletor) {
    const casa = visivel(document.querySelector(o.seletor));
    if (casa) return casa;
  }
  if (o.ponto) return { x: o.ponto.x, y: o.ponto.y, w: 24, h: 24 };
  return o.lugar || null;
}
function deLaParaCa(de: Caixa, para: Caixa) {
  return { translateX: de.x - para.x, translateY: de.y - para.y, scaleX: Math.max(0.06, Math.min(1, de.w / para.w)), scaleY: Math.max(0.04, Math.min(1, de.h / para.h)) };
}

/** A tela cresce a partir da origem até o tamanho dela; o conteúdo aparece quando ela já está quase pronta. */
export function crescerDaOrigem(caixa: HTMLElement, o: Origem | null): boolean {
  const de = lugarDaOrigem(o);
  if (!de || semMovimento()) return false;
  const v = deLaParaCa(de, caixaDe(caixa));
  const ms = jeito === 'suave' ? 680 : 520;
  caixa.style.transformOrigin = '50% 50%';
  animate(caixa, {
    translateX: [v.translateX, 0], translateY: [v.translateY, 0], scaleX: [v.scaleX, 1], scaleY: [v.scaleY, 1],
    opacity: { from: 0.3, to: 1, duration: 200, ease: 'linear' },
    ...(jeito === 'viva' ? { ease: mola(0.22, 620) } : { duration: ms, ease: MOVER }),
    onComplete: a => { cleanInlineStyles(a); },
  });
  animate(caixa.querySelectorAll(':scope > *'), { opacity: [0, 1], delay: ms * 0.45, duration: 260, ease: 'linear', onComplete: a => { cleanInlineStyles(a); } });
  return true;
}

/**
 * A tela volta para a origem: o inverso exato da abertura — a mesma duração e a mesma curva, só que encolhendo. Ela vai
 * inteira (com o conteúdo à vista) diminuindo e andando até o botão/linha; o conteúdo só apaga quando ela já está
 * pequena, e a caixa só some no último trecho, já em cima da origem. null: não tem para onde voltar.
 */
export function voltarParaOrigem(caixa: HTMLElement, o: Origem | null): Promise<void> | null {
  const para = lugarDaOrigem(o);
  if (!para || semMovimento()) return null;
  const v = deLaParaCa(para, caixaDe(caixa));
  const ms = jeito === 'suave' ? 680 : 520;
  caixa.style.transformOrigin = '50% 50%';
  animate(caixa.querySelectorAll(':scope > *'), { opacity: 0, delay: ms * 0.4, duration: ms * 0.25, ease: 'linear' });
  return new Promise(ok => {
    animate(caixa, {
      translateX: [0, v.translateX], translateY: [0, v.translateY], scaleX: [1, v.scaleX], scaleY: [1, v.scaleY],
      opacity: { from: 1, to: 0, delay: ms * 0.78, duration: ms * 0.22, ease: 'linear' },
      duration: ms, ease: MOVER, onComplete: () => ok(),
    });
  });
}

/**
 * O fundo escuro de uma janela que está voltando para a origem: apaga só a cor (e o desfoque), não a opacidade — a
 * janela está dentro dele, e apagar a opacidade do fundo levaria a janela junto antes de ela chegar à origem.
 */
export function apagarFundo(fundo: HTMLElement): Promise<void> {
  if (semMovimento()) return Promise.resolve();
  return new Promise(ok => {
    animate(fundo, {
      backgroundColor: 'rgba(0,0,0,0)', backdropFilter: 'blur(0px)',
      duration: jeito === 'suave' ? 600 : 460, ease: ENTRAR, onComplete: () => ok(),
    });
  });
}

