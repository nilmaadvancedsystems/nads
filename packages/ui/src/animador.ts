// O animador do nads (animejs, 01/10/2026): as peças que aparecem por cima da tela entram animadas sozinhas, em
// qualquer aplicativo, sem cada tela precisar lembrar. Um MutationObserver vê o elemento entrar no DOM e anima do
// JEITO escolhido (marca, viva ou suave — as receitas estão em animacao.ts):
//   janela (.modal-overlay + .modal, .cad-janela-fundo)  o fundo acende e a janela chega
//   gaveta ☰ (.drawer)                                   desliza da esquerda; os itens chegam em cascata
//   menus (.popover, .ctx-menu)                          saem do ponto de onde foram abertos
//   avisos (.toast)                                      sobem de baixo
//   faixas e alertas                                     descem de leve e aparecem
//   selo de sucesso (.modal-ok)                          o check encaixa com mola
//   tela de entrar (#login)                              a marca, o título e a caixa chegam em cascata
// E o toque nos botões: apertou, o botão afunda; soltou, volta (com mola, na marca e na viva).
// Menos movimento (prefers-reduced-motion): só o esmaecer, sem deslocar (animar, em animacao.ts); sem toque nos botões.
import { afundar, animar, entrar, MOLA_VIVA, semMovimento, voltar } from './animacao';

type Entrada = (el: HTMLElement) => void;

function janela(el: HTMLElement, caixa: HTMLElement | null) {
  entrar('fundo', el);
  if (caixa) entrar('janela', caixa);
}

const ENTRADAS: [string, Entrada][] = [
  ['.modal-overlay', el => {
    janela(el, el.querySelector<HTMLElement>('.modal'));
    const selo = el.querySelector<HTMLElement>('.modal-ok .modal-icon');
    if (selo) animar(selo, { opacity: [0, 1], scale: [0.5, 1], rotate: [-40, 0], delay: 220, ease: MOLA_VIVA });
  }],
  ['.cad-janela-fundo', el => { janela(el, el.firstElementChild as HTMLElement | null); }],
  ['.drawer-overlay', el => { entrar('fundo', el); }],
  ['.drawer', el => {
    entrar('gaveta', el);
    entrar('gavetaItens', el.querySelectorAll('.drawer-item'));
  }],
  // os menus de botão nascem do canto que encosta no botão (o .popover-wrap): à direita ou à esquerda, em cima ou embaixo
  ['.popover', el => {
    const pai = el.parentElement?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (pai) el.style.transformOrigin = (r.top >= pai.top ? 'top ' : 'bottom ') + (Math.abs(r.right - pai.right) < Math.abs(r.left - pai.left) ? 'right' : 'left');
    entrar('menu', el);
  }],
  // o menu do botão direito nasce no ponteiro (o canto de cima à esquerda)
  ['.ctx-menu', el => {
    el.style.transformOrigin = 'top left';
    entrar('menu', el);
  }],
  ['.toast', el => { entrar('aviso', el); }],
  ['#login', el => { entrar('login', el.querySelectorAll(':scope > *, .auth > *')); }],
  ['.alert, .imp-aviso-barra, .drive-pedido, .liberar-aviso, .versao-nova, .envio-lista li, .meus-lista li', el => { entrar('alerta', el); }],
];

const vistos = new WeakSet<Element>();

function animarSeEntrou(no: Node) {
  if (!(no instanceof HTMLElement)) return;
  for (const [seletor, chegar] of ENTRADAS) {
    const achados: HTMLElement[] = [];
    if (no.matches(seletor)) achados.push(no);
    no.querySelectorAll<HTMLElement>(seletor).forEach(x => achados.push(x));
    for (const el of achados) {
      if (vistos.has(el)) continue;
      vistos.add(el);
      chegar(el);
    }
  }
}

// o toque nos botões
const TOCAVEIS = '.btn:not(:disabled), .icon-btn:not(:disabled), .explorador-cmd:not(:disabled), .chip-f:not(:disabled), .step-pill, .gh-hamb';
let apertado: HTMLElement | null = null;
function apertar(ev: PointerEvent) {
  const alvo = (ev.target as Element | null)?.closest<HTMLElement>(TOCAVEIS);
  if (!alvo || ev.button !== 0 || semMovimento()) return;
  apertado = alvo;
  afundar(alvo);
}
function soltar() {
  if (!apertado) return;
  voltar(apertado);
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
