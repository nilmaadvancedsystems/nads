// O animador do nads (animejs, 01/10/2026): as peças que aparecem por cima da tela entram animadas sozinhas, em
// qualquer aplicativo, sem cada tela precisar lembrar. Um MutationObserver vê o elemento entrar no DOM e anima
// (receitas da casa, em animacao.ts):
//   janela (.modal-overlay + .modal)  fundo e janela juntos, como uma peça só: apaga→acende e 0,96→1, 250 ms
//   gaveta ☰ (.drawer)                desliza da esquerda na curva da gaveta (380 ms); os itens chegam em cascata
//   menus (.popover, .ctx-menu)       saem do ponto de onde foram abertos (0,95→1, 150–200 ms)
//   avisos (.toast)                   sobem de baixo no ritmo "ease" (mais elegante, 400 ms) e saem por baixo
//   faixas e alertas                  sobem 6 px e aparecem (.alert, .drive-pedido, .liberar-aviso, .versao-nova…)
//   selo de sucesso (.modal-ok)       o check encaixa com mola (é raro: aqui pode ter festa)
//   tela de entrar (#login)           a marca, o título e a caixa chegam em cascata
// E o toque nos botões: apertou, o botão afunda (0,97, 160 ms); soltou, volta. Teclado não anima (só o clique/toque).
// Menos movimento (prefers-reduced-motion): só o esmaecer, sem deslocar (animar, em animacao.ts); sem toque nos botões.
import { cleanInlineStyles, stagger, type JSAnimation } from 'animejs';
import { animar, ENTRAR, GAVETA, MOLA_VIVA, semMovimento, SUAVE } from './animacao';

type Entrada = (el: HTMLElement) => void;
// a janela assentou: tira o transform parado (ele prenderia o position:fixed de quem está dentro)
const limpar = (a: JSAnimation) => { cleanInlineStyles(a); };

const ENTRADAS: [string, Entrada][] = [
  ['.modal-overlay', el => {
    animar(el, { opacity: [0, 1], duration: 250, ease: ENTRAR });
    const janela = el.querySelector<HTMLElement>('.modal');
    if (janela) animar(janela, { opacity: [0, 1], scale: [0.96, 1], duration: 250, ease: ENTRAR, onComplete: limpar });
    const selo = el.querySelector<HTMLElement>('.modal-ok .modal-icon');
    if (selo) animar(selo, { opacity: [0, 1], scale: [0.6, 1], rotate: [-25, 0], delay: 80, ease: MOLA_VIVA });
  }],
  ['.cad-janela-fundo', el => {
    animar(el, { opacity: [0, 1], duration: 250, ease: ENTRAR });
    const janela = el.firstElementChild as HTMLElement | null;
    if (janela) animar(janela, { opacity: [0, 1], scale: [0.96, 1], duration: 250, ease: ENTRAR, onComplete: limpar });
  }],
  ['.drawer-overlay', el => { animar(el, { opacity: [0, 1], duration: 300, ease: ENTRAR }); }],
  ['.drawer', el => {
    animar(el, { translateX: ['-100%', '0%'], duration: 380, ease: GAVETA });
    animar(el.querySelectorAll('.drawer-item'), { opacity: [0, 1], translateX: [-8, 0], delay: stagger(30, { start: 100 }), duration: 260, ease: ENTRAR });
  }],
  // os menus de botão nascem do canto que encosta no botão (o .popover-wrap): à direita ou à esquerda, em cima ou embaixo
  ['.popover', el => {
    const pai = el.parentElement?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (pai) el.style.transformOrigin = (r.top >= pai.top ? 'top ' : 'bottom ') + (Math.abs(r.right - pai.right) < Math.abs(r.left - pai.left) ? 'right' : 'left');
    animar(el, { opacity: [0, 1], scale: [0.95, 1], duration: 200, ease: ENTRAR });
  }],
  // o menu do botão direito nasce no ponteiro (o canto de cima à esquerda)
  ['.ctx-menu', el => {
    el.style.transformOrigin = 'top left';
    animar(el, { opacity: [0, 1], scale: [0.95, 1], duration: 150, ease: ENTRAR });
  }],
  ['.toast', el => { animar(el, { opacity: [0, 1], translateY: ['100%', '0%'], duration: 400, ease: SUAVE }); }],
  ['#login', el => {
    animar(el.querySelectorAll(':scope > *, .auth > *'), { opacity: [0, 1], translateY: [8, 0], delay: stagger(50), duration: 300, ease: ENTRAR });
  }],
  ['.alert, .imp-aviso-barra, .drive-pedido, .liberar-aviso, .versao-nova, .envio-lista li, .meus-lista li', el => {
    animar(el, { opacity: [0, 1], translateY: [6, 0], duration: 250, ease: ENTRAR });
  }],
];

const vistos = new WeakSet<Element>();

function animarSeEntrou(no: Node) {
  if (!(no instanceof HTMLElement)) return;
  for (const [seletor, entrar] of ENTRADAS) {
    const achados: HTMLElement[] = [];
    if (no.matches(seletor)) achados.push(no);
    no.querySelectorAll<HTMLElement>(seletor).forEach(x => achados.push(x));
    for (const el of achados) {
      if (vistos.has(el)) continue;
      vistos.add(el);
      entrar(el);
    }
  }
}

// o toque nos botões (receita "button press": 0,97 em 160 ms na curva de saída forte, nos dois sentidos)
const TOCAVEIS = '.btn:not(:disabled), .icon-btn:not(:disabled), .explorador-cmd:not(:disabled), .chip-f:not(:disabled), .step-pill, .gh-hamb';
let apertado: HTMLElement | null = null;
function apertar(ev: PointerEvent) {
  const alvo = (ev.target as Element | null)?.closest<HTMLElement>(TOCAVEIS);
  if (!alvo || ev.button !== 0 || semMovimento()) return;
  apertado = alvo;
  animar(alvo, { scale: 0.97, duration: 160, ease: ENTRAR });
}
function soltar() {
  if (!apertado) return;
  animar(apertado, { scale: 1, duration: 160, ease: ENTRAR });
  apertado = null;
}

let ligado = false;

/** Liga o animador (uma vez, no main.tsx). */
export function iniciarAnimador(): void {
  if (ligado || typeof window === 'undefined') return;
  ligado = true;
  new MutationObserver(lista => {
    for (const m of lista) m.addedNodes.forEach(animarSeEntrou);
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointerdown', apertar, true);
  document.addEventListener('pointerup', soltar, true);
  document.addEventListener('pointercancel', soltar, true);
}
