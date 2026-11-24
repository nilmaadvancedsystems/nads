// O tutorial no PC com o anime.js (24/11/2026; o dono: "caso a pessoa esteja num pc quero que seja bem cinematico";
// "usa como base o animejs"; "o mais bonito e leve possivel"; e depois: "as coisas tao flicando e ta meio estranho essa
// entrada", "tira esse impact frame, ta muito IA, da uma olhada no anime js pra ver se tem algo melhor"). Só no PC (tela
// larga, mouse) e com as animações ligadas; no celular fica o de antes.
//
// Depois de "ainda sim nao gostei, nao combinou com a estetica, procura como grandes apps fazem" (a pesquisa: Linear, Arc,
// Apple, Stripe, Vercel, Antigravity): um gesto só, movimento curto que assenta devagar (sem quique, sem tremor, sem
// partículas), revelar em vez de voar de longe. A entrada é "do N para o cartão" (o dono escolheu). Os passos: o balão sobe
// de leve e uma linha carmim percorre a volta da parte explicada. Só transform, opacity e clip-path; tudo é desfeito
// (revert) ao trocar de passo.
import { animacoesPedidas } from '@nads/ui';
import { createAnimatable, createTimeline, cubicBezier, stagger, utils } from 'animejs';

type Desfazer = { revert(): unknown };

/** Vale a versão do PC: tela larga e mouse, com as animações ligadas no app e no sistema. */
export function temCinema(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches && animacoesPedidas();
}

const todos = (raiz: Element, sel: string) => [...raiz.querySelectorAll<HTMLElement>(sel)];

/** Chama uma vez só: no fim da animação ou, se ela travar (a aba em segundo plano quase não anima), depois de ms. */
function umaVez(f: () => void, ms: number): () => void {
  let feito = false;
  const t = setTimeout(() => { if (!feito) { feito = true; f(); } }, ms);
  return () => { if (!feito) { feito = true; clearTimeout(t); f(); } };
}

/** A curva das entradas (chega rápido, assenta devagar, sem quique): a dos produtos de referência. */
const ASSENTA = cubicBezier(0.16, 1, 0.3, 1);

/**
 * A entrada do cartão do começo (24/11/2026, o dono escolheu "Do N para o cartão", à moda do Linear e do Arc; depois "tira
 * o moviemento do n"): o N fica parado no quadrado e o cartão nasce de trás dele (um recorte que abre a partir do lugar do
 * N); o título sobe 10 px, os capítulos vêm um a um e os botões por último. ~1,4 s. Depois, o cartão se entorta de leve
 * para o lado do mouse.
 */
export function abertura(raiz: HTMLElement, cartao: HTMLElement): Desfazer {
  const feitos: Desfazer[] = [];
  const fundo = raiz.querySelector<HTMLElement>('.cli-tut-fundo');
  const luz = raiz.querySelector<HTMLElement>('.cli-tut-luz');
  // o que fica no quadrado: o N no começo, o ✓ no "Tudo pronto!" (24/11/2026: "tudo pronto a basicamente a mesma animacao do inicial")
  const marca = cartao.querySelector<HTMLElement>('.cli-tut-marca') ?? cartao.querySelector<HTMLElement>('.cli-tut-heroi > svg');
  // medido antes de esconder: o cartão está no lugar dele, sem transform
  const rc = cartao.getBoundingClientRect();
  const rm = marca?.getBoundingClientRect();
  // o começo já, antes de a tela pintar (sem piscar o cartão pronto)
  utils.set(cartao, { opacity: 0 });
  if (marca) utils.set(marca, { opacity: 0 });

  const tl = createTimeline({ autoplay: true });
  if (fundo) tl.add(fundo, { opacity: [0, 1], duration: 420, ease: 'linear' }, 0);
  if (luz) tl.add(luz, { opacity: [0, 1], duration: 1200, ease: 'linear' }, 0);
  // (24/11/2026: "tira o moviemento do n") o N não voa mais: fica parado no quadrado e só acende junto com o cartão
  if (marca) tl.add(marca, { opacity: [0, 1], duration: 500, ease: 'linear' }, 420);
  // 3. o cartão nasce de trás do N: o recorte abre a partir do lugar onde o N pousa
  if (rm && rc.height) {
    const cima = ((rm.top - rc.top) / rc.height) * 100, esq = ((rm.left - rc.left) / rc.width) * 100;
    const baixo = ((rc.bottom - rm.bottom) / rc.height) * 100, dir = ((rc.right - rm.right) / rc.width) * 100;
    tl.add(cartao, { opacity: [0, 1], duration: 160, ease: 'linear' }, 300)
      .add(cartao, { clipPath: [`inset(${cima}% ${dir}% ${baixo}% ${esq}% round 22px)`, 'inset(0% 0% 0% 0% round 16px)'], duration: 720, ease: ASSENTA }, 300);
  } else tl.add(cartao, { opacity: [0, 1], translateY: [16, 0], duration: 500, ease: ASSENTA }, 300);
  // 4. o título, o texto, os capítulos e os botões
  const titulo = cartao.querySelector<HTMLElement>('h2');
  const resto = [...todos(cartao, ':scope > p'), ...todos(cartao, '.cli-tut-tempo')];
  const chips = todos(cartao, '.cli-tut-roteiro li');
  const pe = cartao.querySelector<HTMLElement>('.cli-tut-pe');
  const conteudo = [titulo, ...resto, ...chips, pe].filter((x): x is HTMLElement => !!x);
  if (conteudo.length) utils.set(conteudo, { opacity: 0 });
  if (titulo) tl.add(titulo, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: ASSENTA }, 650);
  if (resto.length) tl.add(resto, { opacity: [0, 1], translateY: [8, 0], duration: 400, ease: ASSENTA, delay: stagger(70) }, 760);
  if (chips.length) tl.add(chips, { opacity: [0, 1], translateY: [8, 0], duration: 380, ease: ASSENTA, delay: stagger(60) }, 840);
  if (pe) tl.add(pe, { opacity: [0, 1], duration: 300, ease: 'linear' }, 1100);
  feitos.push(tl);
  // (24/11/2026: "quero uma animacao de mecher o mouse como tava antes") depois de assentar, o cartão inclina de leve para
  // o lado do mouse e o brilho atrás acompanha, devagar: profundidade só com transform
  let mexe: ((e: PointerEvent) => void) | null = null;
  const comeca = setTimeout(() => {
    utils.set(cartao, { clipPath: 'none' });
    // (24/11/2026: "o quadrado inteiro nao o N", "quando eu mechesse ele se entortava um pouco") o cartão inteiro se
    // entorta de leve para o lado do mouse, como antes (a perspectiva está no .cli-tut.cinema)
    const c = createAnimatable(cartao, { rotateX: 900, rotateY: 900, ease: 'outQuad' });
    const l = luz ? createAnimatable(luz, { x: 1400, y: 1400, ease: 'outQuad' }) : null;
    mexe = e => {
      const dx = e.clientX / window.innerWidth - 0.5, dy = e.clientY / window.innerHeight - 0.5;
      c.rotateY(dx * 8);
      c.rotateX(-dy * 7);
      l?.x(dx * 140);
      l?.y(dy * 100);
    };
    window.addEventListener('pointermove', mexe);
    feitos.push(c, ...(l ? [l] : []));
  }, 1450);
  return { revert: () => { clearTimeout(comeca); if (mexe) window.removeEventListener('pointermove', mexe); feitos.forEach(f => f.revert()); } };
}

/**
 * O fim do tutorial sem corte seco (24/11/2026: "quando finaliza o tutorial todo animado so vem um corte seco pra tela
 * inicial dnv"): o cartão (ou o balão) sai de leve, o escuro se dissolve mostrando a tela que já está por baixo, e os
 * cartões dela sobem um a um. depois: fecha o tutorial de verdade.
 */
export function saidaDoTutorial(raiz: HTMLElement, depois: () => void): void {
  const fim = umaVez(depois, 1600);
  const tl = createTimeline({ autoplay: true, onComplete: fim });
  const balao = raiz.querySelector<HTMLElement>('.cli-tut-balao');
  if (balao) tl.add(balao, { opacity: 0, scale: 0.96, translateY: 8, duration: 380, ease: 'inQuad' }, 0);
  const resto = [...raiz.children].filter((x): x is HTMLElement => (x instanceof HTMLElement || x instanceof SVGElement) && x !== balao) as HTMLElement[];
  if (resto.length) tl.add(resto, { opacity: 0, duration: 650, ease: 'outQuad' }, 180);
  // a tela de baixo: os cartões sobem um a um enquanto o escuro some
  const cartoes = [...document.querySelectorAll<HTMLElement>('.cli-main .card')].filter(c => c.getBoundingClientRect().top < window.innerHeight).slice(0, 8);
  if (cartoes.length) {
    tl.add(cartoes, { opacity: [0.35, 1], translateY: [14, 0], duration: 700, ease: ASSENTA, delay: stagger(70) }, 240);
    tl.call(() => { cartoes.forEach(c => { c.style.opacity = ''; c.style.transform = ''; }); }, 1200);
  }
}

/** Começar: o cartão some de leve (0,97) e o holofote apaga; depois, o primeiro passo. */
export function saidaDoCartao(raiz: HTMLElement, cartao: HTMLElement, depois: () => void): void {
  const fim = umaVez(depois, 700);
  const tl = createTimeline({ autoplay: true, onComplete: fim });
  tl.add(cartao, { opacity: 0, scale: 0.97, duration: 300, ease: 'inQuad' }, 0);
  const luz = raiz.querySelector<HTMLElement>('.cli-tut-luz');
  if (luz) tl.add(luz, { opacity: 0, duration: 300, ease: 'linear' }, 0);
}

/** Um passo: o balão sobe de leve e o conteúdo vem em cascata; a linha carmim percorre a volta da parte. */
export function entradaDoPasso(balao: HTMLElement, moldura?: SVGRectElement | null): Desfazer {
  // (24/11/2026: "os menus estao piscando quando aparecem") o anime.js só aplica o começo no próximo quadro: sem isto, o
  // balão aparecia pronto por um quadro, sumia e entrava. O começo vai já, antes de a tela pintar
  const partes = [...todos(balao, ':scope > h2'), ...todos(balao, ':scope > p'), ...todos(balao, '.cli-tut-topicos li')];
  utils.set(balao, { opacity: 0, translateY: 10 });
  if (partes.length) utils.set(partes, { opacity: 0, translateY: 6 });
  // (24/11/2026: "quero animacao quando aparecer o negocio envolta da tela") o anel chega como um foco de câmera:
  // nasce maior e transparente, aperta até a parte com um brilho grosso que afina, e depois se apaga (fica o anel fixo)
  if (moldura) utils.set(moldura, { opacity: 0, scale: 1.12, strokeWidth: 7 });
  // (24/11/2026: "ta muito acelerado as trocas", "quero que deixe mais suave") o balão espera o destaque chegar à parte
  // nova (0,25 s) e entra devagar; o conteúdo em cascata mais espaçada; a linha percorre a volta sem pressa
  const tl = createTimeline({ autoplay: true });
  tl.add(balao, { opacity: [0, 1], translateY: [10, 0], duration: 700, ease: ASSENTA }, 250);
  if (partes.length) tl.add(partes, { opacity: [0, 1], translateY: [6, 0], duration: 650, ease: ASSENTA, delay: stagger(90) }, 380);
  if (moldura) {
    tl.add(moldura, { opacity: [0, 1], duration: 260, ease: 'linear' }, 0)
      .add(moldura, { scale: [1.12, 1], strokeWidth: [7, 2], duration: 850, ease: ASSENTA }, 0)
      .add(moldura, { opacity: [1, 0], duration: 900, ease: 'inOutSine' }, 1100);
  }
  return tl;
}
