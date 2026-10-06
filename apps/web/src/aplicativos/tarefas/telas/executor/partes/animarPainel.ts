// As animações da checklist disfarçada do Fiscal — pedido do Vitor (06/10/2026: "quero mais animações também, use o
// animejs"), uma exceção à regra de só animar o carregamento. Os componentes desenham o estado final (sem JS, ou com
// "menos movimento" no sistema, fica tudo parado e certo); aqui, ao aparecer, os números contam do zero, as barras
// crescem, os anéis e a rosca se desenham e os cartões entram um atrás do outro.
import { formatos } from '@nads/core';
import { animate, spring, stagger, svg, utils } from 'animejs';

export const menosMovimento = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FORMATOS: Record<string, (v: number) => string> = {
  reais: v => formatos.reais(v),
  int: v => Math.round(v).toLocaleString('pt-BR'),
  pct: v => Math.round(v).toLocaleString('pt-BR') + '%',
};

/** Dá vida a um painel que acabou de aparecer (o que estiver dentro de raiz). */
export function animarPainel(raiz: HTMLElement | null) {
  if (!raiz || menosMovimento()) return;
  // as peças do painel (Stat, rank, tabela, gráficos, alertas) aparecem de baixo, em sequência
  const pecas = raiz.children;
  if (pecas.length) { utils.set(pecas, { opacity: 0, translateY: 10 }); animate(pecas, { opacity: [0, 1], translateY: [10, 0], duration: 420, delay: stagger(80), ease: 'outQuad' }); }
  // os números (no Stat) contam do zero até o valor
  raiz.querySelectorAll<HTMLElement>('[data-conta]').forEach(el => {
    const fim = Number(el.dataset.conta) || 0;
    const fmt = FORMATOS[el.dataset.formato || 'int'] || FORMATOS.int;
    const o = { v: 0 };
    animate(o, { v: fim, duration: 900, ease: 'outExpo', onUpdate: () => { el.textContent = fmt(o.v); }, onComplete: () => { el.textContent = fmt(fim); } });
  });
  // as barras do rank crescem da esquerda
  const deitadas = raiz.querySelectorAll('.rank-barra > span');
  if (deitadas.length) { utils.set(deitadas, { scaleX: 0 }); animate(deitadas, { scaleX: [0, 1], duration: 800, delay: stagger(60, { start: 200 }), ease: 'outExpo' }); }
}

/** As faixas das tarefas entram uma atrás da outra. */
export function animarCartoes(raiz: HTMLElement | null) {
  if (!raiz || menosMovimento()) return;
  const cartoes = raiz.querySelectorAll('.pt-tarefa');
  if (cartoes.length) utils.set(cartoes, { opacity: 0, translateY: 18 });
  if (cartoes.length) animate(cartoes, { opacity: [0, 1], translateY: [18, 0], scale: [0.985, 1], duration: 520, delay: stagger(70), ease: 'outQuart' });
}

/** O "Conferido": a caixinha da tarefa vira o check com um pulo. */
export function pularCheck(el: Element | null) {
  if (!el || menosMovimento()) return;
  animate(el, { scale: [0.4, 1], rotate: ['-25deg', '0deg'], ease: spring({ bounce: 0.55, duration: 520 }) });
}

/** A barra de progresso anda até a fração nova. */
export function andarProgresso(el: HTMLElement | null, fracao: number) {
  if (!el) return;
  if (menosMovimento()) { el.style.width = fracao * 100 + '%'; return; }
  animate(el, { width: fracao * 100 + '%', duration: 700, ease: 'outExpo' });
}

/**
 * O "Tudo pronto" do fim da rotina (Vitor, 06/10/2026: "animação disso aqui"): o círculo e o ✓ se desenham, o ícone
 * pula, uma onda verde sai dele e o título, o texto e os botões sobem em sequência.
 */
export function animarPronto(raiz: HTMLElement | null) {
  if (!raiz || menosMovimento()) return;
  const icone = raiz.querySelector('svg');
  const resto = raiz.querySelectorAll(':scope > h2, :scope > p, :scope > .executor-fim-botoes');
  utils.set(resto, { opacity: 0, translateY: 14 });
  if (icone) {
    animate(icone, { scale: [0.3, 1], rotate: ['-30deg', '0deg'], ease: spring({ bounce: 0.5, duration: 700 }) });
    animate(svg.createDrawable(icone.querySelectorAll('circle, path')), { draw: ['0 0', '0 1'], duration: 700, delay: stagger(260), ease: 'inOutQuad' });
  }
  const onda = raiz.querySelector('.executor-fim-onda');
  if (onda) animate(onda, { scale: [0.4, 2.4], opacity: [0.55, 0], duration: 1100, delay: 520, ease: 'outCubic' });
  animate(resto, { opacity: [0, 1], translateY: [14, 0], duration: 520, delay: stagger(110, { start: 650 }), ease: 'outQuart' });
}
