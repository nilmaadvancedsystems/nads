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
import { animacoesPedidas, ENTRAR, molaViva } from '@nads/ui';
import { createDrawable, createTimeline, cubicBezier, stagger, utils } from 'animejs';

type Desfazer = { revert(): unknown };

/** Vale a versão do PC: tela larga e mouse, com as animações ligadas no app e no sistema. */
export function temCinema(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').matches && animacoesPedidas();
}

const todos = (raiz: Element, sel: string) => [...raiz.querySelectorAll<HTMLElement>(sel)];

/** A curva das entradas (chega rápido, assenta devagar, sem quique): a dos produtos de referência. */
const ASSENTA = cubicBezier(0.16, 1, 0.3, 1);

/**
 * A entrada do cartão do começo (24/11/2026, o dono escolheu "Do N para o cartão", à moda do Linear e do Arc): o N grande
 * se revela do centro para os lados como uma cortina e fica parado um instante; depois encolhe e voa até o topo do cartão
 * enquanto o cartão nasce de trás dele (um recorte que abre a partir do lugar do N); o título sobe 10 px, os capítulos
 * vêm um a um e os botões por último. Um objeto só leva o olho do logo ao conteúdo. ~1,7 s.
 */
export function abertura(raiz: HTMLElement, cartao: HTMLElement): Desfazer {
  const feitos: Desfazer[] = [];
  const fundo = raiz.querySelector<HTMLElement>('.cli-tut-fundo');
  const luz = raiz.querySelector<HTMLElement>('.cli-tut-luz');
  const voo = raiz.querySelector<HTMLElement>('.cli-tut-voo > span');
  const marca = cartao.querySelector<HTMLElement>('.cli-tut-marca');
  // medido antes de esconder: o cartão está no lugar dele, sem transform
  const rc = cartao.getBoundingClientRect();
  const rm = marca?.getBoundingClientRect();
  const rv = voo?.getBoundingClientRect();
  // o começo já, antes de a tela pintar (sem piscar o cartão pronto)
  utils.set(cartao, { opacity: 0 });
  if (marca) utils.set(marca, { opacity: 0 });
  if (voo) utils.set(voo, { opacity: 0, clipPath: 'inset(0% 50% 0% 50%)' });

  const tl = createTimeline({ autoplay: true });
  if (fundo) tl.add(fundo, { opacity: [0, 1], duration: 420, ease: 'linear' }, 0);
  if (luz) tl.add(luz, { opacity: [0, 1], duration: 1200, ease: 'linear' }, 0);
  // 1. o N grande abre do centro para os lados
  if (voo) tl.add(voo, { opacity: [0, 1], clipPath: ['inset(0% 50% 0% 50%)', 'inset(0% 0% 0% 0%)'], duration: 560, ease: ASSENTA }, 60);
  // 2. a pausa (0,5 a 0,7 s) e o voo até o topo do cartão
  if (voo && rm && rv && rv.height) {
    const escala = rm.height / rv.height;
    const dx = rm.left + rm.width / 2 - (rv.left + rv.width / 2), dy = rm.top + rm.height / 2 - (rv.top + rv.height / 2);
    tl.add(voo, { x: [0, dx], y: [0, dy], scale: [1, escala], duration: 560, ease: 'inOutQuart' }, 700);
    // pousou: a marca do cartão fica no lugar e a que voou sai (as duas no mesmo ponto: troca sem salto)
    if (marca) tl.add(marca, { opacity: [0, 1], duration: 1, ease: 'linear' }, 1260);
    tl.add(voo, { opacity: [1, 0], duration: 1, ease: 'linear' }, 1262);
  } else if (marca) tl.add(marca, { opacity: [0, 1], duration: 300, ease: 'linear' }, 700);
  // 3. o cartão nasce de trás do N: o recorte abre a partir do lugar onde o N pousa
  if (rm && rc.height) {
    const cima = ((rm.top - rc.top) / rc.height) * 100, esq = ((rm.left - rc.left) / rc.width) * 100;
    const baixo = ((rc.bottom - rm.bottom) / rc.height) * 100, dir = ((rc.right - rm.right) / rc.width) * 100;
    tl.add(cartao, { opacity: [0, 1], duration: 160, ease: 'linear' }, 760)
      .add(cartao, { clipPath: [`inset(${cima}% ${dir}% ${baixo}% ${esq}% round 22px)`, 'inset(0% 0% 0% 0% round 16px)'], duration: 620, ease: ASSENTA }, 760);
  } else tl.add(cartao, { opacity: [0, 1], translateY: [16, 0], duration: 500, ease: ASSENTA }, 760);
  // 4. o título, o texto, os capítulos e os botões
  const titulo = cartao.querySelector<HTMLElement>('h2');
  const resto = [...todos(cartao, ':scope > p'), ...todos(cartao, '.cli-tut-tempo')];
  const chips = todos(cartao, '.cli-tut-roteiro li');
  const pe = cartao.querySelector<HTMLElement>('.cli-tut-pe');
  const conteudo = [titulo, ...resto, ...chips, pe].filter((x): x is HTMLElement => !!x);
  if (conteudo.length) utils.set(conteudo, { opacity: 0 });
  if (titulo) tl.add(titulo, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: ASSENTA }, 1050);
  if (resto.length) tl.add(resto, { opacity: [0, 1], translateY: [8, 0], duration: 400, ease: ASSENTA, delay: stagger(70) }, 1150);
  if (chips.length) tl.add(chips, { opacity: [0, 1], translateY: [8, 0], duration: 380, ease: ASSENTA, delay: stagger(60) }, 1220);
  if (pe) tl.add(pe, { opacity: [0, 1], duration: 300, ease: 'linear' }, 1500);
  feitos.push(tl);
  return { revert: () => feitos.forEach(f => f.revert()) };
}

/** Começar: o cartão some de leve (0,97) e o holofote apaga; depois, o primeiro passo. */
export function saidaDoCartao(raiz: HTMLElement, cartao: HTMLElement, depois: () => void): void {
  const tl = createTimeline({ autoplay: true, onComplete: depois });
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
  const linha = moldura ? createDrawable(moldura as unknown as SVGGeometryElement) : null;
  if (linha) utils.set(linha, { draw: '0 0' });
  const tl = createTimeline({ autoplay: true });
  tl.add(balao, { opacity: [0, 1], translateY: [10, 0], duration: 420, ease: ENTRAR }, 0);
  if (partes.length) tl.add(partes, { opacity: [0, 1], translateY: [6, 0], duration: 420, ease: ENTRAR, delay: stagger(50) }, 80);
  if (linha) tl.add(linha, { draw: ['0 0', '0 1', '1 1'], duration: 1200, ease: 'inOutQuad' }, 0);
  return tl;
}

/** O cartão do fim: sobe firme, o ✓ entra em mola e os capítulos se marcam um a um. */
export function festaDoFim(cartao: HTMLElement): Desfazer {
  // o começo já, antes de a tela pintar (sem piscar)
  utils.set(cartao, { opacity: 0, translateY: 24, scale: 0.95 });
  const tl = createTimeline({ autoplay: true });
  tl.add(cartao, { opacity: [0, 1], translateY: [24, 0], scale: [0.95, 1], duration: 700, ease: ENTRAR }, 0);
  const heroi = cartao.querySelector<HTMLElement>('.cli-tut-heroi');
  if (heroi) tl.add(heroi, { scale: [0.3, 1], duration: 800, ease: molaViva() }, 150);
  const chips = todos(cartao, '.cli-tut-roteiro li');
  if (chips.length) tl.add(chips, { opacity: [0, 1], translateY: [8, 0], duration: 520, ease: ENTRAR, delay: stagger(90) }, 450);
  const pe = cartao.querySelector<HTMLElement>('.cli-tut-pe');
  if (pe) tl.add(pe, { opacity: [0, 1], translateY: [10, 0], duration: 520, ease: ENTRAR }, 750);
  return tl;
}
