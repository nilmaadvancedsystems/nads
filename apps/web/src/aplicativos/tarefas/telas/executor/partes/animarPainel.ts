// As animações da checklist disfarçada do Fiscal — pedido do Vitor (06/10/2026: "quero mais animações também, use o
// animejs"), uma exceção à regra de só animar o carregamento. Os componentes desenham o estado final (sem JS, ou com
// "menos movimento" no sistema, fica tudo parado e certo); aqui, ao aparecer, os números contam do zero, as barras
// crescem, os anéis e a rosca se desenham e os cartões entram um atrás do outro.
import { formatos } from '@nads/core';
import { animate, spring, stagger, utils } from 'animejs';

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
  // os números (no Stat e na rosca) contam do zero até o valor
  raiz.querySelectorAll<HTMLElement>('[data-conta]').forEach(el => {
    const fim = Number(el.dataset.conta) || 0;
    const fmt = FORMATOS[el.dataset.formato || 'int'] || FORMATOS.int;
    const o = { v: 0 };
    animate(o, { v: fim, duration: 900, ease: 'outExpo', onUpdate: () => { el.textContent = fmt(o.v); }, onComplete: () => { el.textContent = fmt(fim); } });
  });
  // as barras dos dias sobem; as do rank e da faixa 100% crescem da esquerda
  const dias = raiz.querySelectorAll('.graf-dia > span');
  if (dias.length) { utils.set(dias, { scaleY: 0 }); animate(dias, { scaleY: [0, 1], duration: 650, delay: stagger(18, { start: 150 }), ease: 'outBack(1.4)' }); }
  const deitadas = raiz.querySelectorAll('.rank-barra > span, .graf-faixa > span');
  if (deitadas.length) { utils.set(deitadas, { scaleX: 0 }); animate(deitadas, { scaleX: [0, 1], duration: 800, delay: stagger(60, { start: 200 }), ease: 'outExpo' }); }
  // a rosca gira para o lugar e as fatias acendem uma a uma
  raiz.querySelectorAll('.graf-rosca svg').forEach(svg => {
    const fatias = svg.querySelectorAll('.graf-rosca-fatia');
    animate(svg, { rotate: ['-140deg', '0deg'], scale: [0.7, 1], ease: spring({ bounce: 0.3, duration: 900 }) });
    utils.set(fatias, { opacity: 0 });
    animate(fatias, { opacity: [0, 1], duration: 380, delay: stagger(110, { start: 120 }), ease: 'outQuad' });
  });
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
