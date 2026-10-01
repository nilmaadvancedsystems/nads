// O animador do nads (animejs, 01/10/2026): as peças que aparecem por cima da tela entram animadas sozinhas, em
// qualquer aplicativo, sem cada tela precisar lembrar. Um MutationObserver vê o elemento entrar no DOM e anima do
// JEITO escolhido (marca, viva ou suave — as receitas estão em animacao.ts):
//   janela (.modal-overlay + .modal, .cad-janela-fundo)  o fundo acende e a janela chega
//   gaveta ☰ (.drawer)                                   desliza da esquerda; os itens chegam em cascata
//   menus (.popover, .ctx-menu)                          saem do ponto de onde foram abertos
//   faixas e alertas                                     descem de leve e aparecem
//   selo de sucesso (.modal-ok)                          o check encaixa com mola
//   tela de entrar (#login)                              a marca, o título e a caixa chegam em cascata
// E o toque nos botões: apertou, o botão afunda; soltou, volta (com mola, na marca e na viva).
// As saídas: janela, menu e abertura saem animadas mesmo quando o React tira do DOM de uma vez (o "fantasma", abaixo).
// O check da janela de sucesso e o das etapas feitas se desenham.
// Menos movimento (prefers-reduced-motion): só o esmaecer, sem deslocar (animar, em animacao.ts); sem toque nos botões.
import { afundar, animar, celebrar, desenharCheck, encerrarPaginas, entrar, MOLA_VIVA, revelarTitulo, sairComo, semMovimento, voltar } from './animacao';

type Entrada = (el: HTMLElement) => void;

function janela(el: HTMLElement, caixa: HTMLElement | null) {
  encerrarPaginas();
  entrar('fundo', el);
  if (caixa) entrar('janela', caixa);
}

const ENTRADAS: [string, Entrada][] = [
  ['.modal-overlay', el => {
    janela(el, el.querySelector<HTMLElement>('.modal'));
    const selo = el.querySelector<HTMLElement>('.modal-ok .modal-icon');
    if (selo) {
      animar(selo, { opacity: [0, 1], scale: [0.5, 1], rotate: [-40, 0], delay: 220, ease: MOLA_VIVA });
      const svg = selo.querySelector('svg');
      if (svg) desenharCheck(svg, 320);
    }
  }],
  // a etapa feita (a caixinha da lateral): a caixinha encaixa e o check se desenha
  ['.subnav-caixa.marcada > svg', el => {
    if (el.parentElement) animar(el.parentElement, { scale: [0.6, 1], ease: MOLA_VIVA });
    desenharCheck(el as unknown as SVGSVGElement, 80);
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
    encerrarPaginas();
    el.style.transformOrigin = 'top left';
    entrar('menu', el);
  }],
  ['#login', el => { entrar('login', el.querySelectorAll(':scope > *, .auth > *')); }],
  ['.alert, .imp-aviso-barra, .drive-pedido, .liberar-aviso, .versao-nova, .envio-lista li, .meus-lista li', el => {
    entrar('alerta', el);
    // o alerta verde (deu certo): o check do círculo se desenha
    const svg = el.querySelector<SVGSVGElement>(':scope > svg');
    if (svg && (el.getAttribute('style') || '').includes('success') && svg.querySelector('circle')) celebrar(svg, false);
  }],
  // tudo pronto no executor (todas as etapas feitas): é raro — o selo, o check, as faíscas e o título revelado
  ['.executor-fim', el => {
    const svg = el.querySelector<SVGSVGElement>('svg');
    if (svg) celebrar(svg);
    const h = el.querySelector<HTMLElement>('h2');
    if (h) revelarTitulo(h);
  }],
  // o Ok do banco (extrato e razão batem): encaixa com mola
  ['.badge-ok', el => { animar(el, { opacity: [0, 1], scale: [0.6, 1], ease: MOLA_VIVA }); }],
];

const vistos = new WeakSet<Element>();

function animarSeEntrou(no: Node) {
  if (!(no instanceof Element) || no.closest('[data-fantasma]')) return;
  for (const [seletor, chegar] of ENTRADAS) {
    const achados: HTMLElement[] = [];
    if (no.matches(seletor)) achados.push(no as HTMLElement);
    no.querySelectorAll<HTMLElement>(seletor).forEach(x => achados.push(x));
    for (const el of achados) {
      if (vistos.has(el)) continue;
      vistos.add(el);
      chegar(el);
    }
  }
}

// As saídas: o React tira a janela (ou o menu) do DOM de uma vez; o animador põe no lugar uma cópia inerte (o
// "fantasma"), anima a saída dela do jeito do app e a apaga. Quem já anima a própria saída (o modal do retorno, a
// gaveta) marca data-saida-propria.
type Saida = (fantasma: HTMLElement) => Promise<unknown>;
const SAIDAS: [string, Saida, 'fixo' | 'no-lugar'][] = [
  ['.modal-overlay:not([data-saida-propria]), .cad-janela-fundo', f => {
    const caixa = (f.querySelector<HTMLElement>('.modal') || f.firstElementChild) as HTMLElement | null;
    return Promise.all([sairComo('fundo', f), caixa ? sairComo('janela', caixa) : null]);
  }, 'fixo'],
  ['.ctx-menu', f => sairComo('menu', f), 'fixo'],
  ['.popover', f => sairComo('menu', f), 'no-lugar'],
  // a abertura do app: some crescendo de leve e saindo do foco (a tela de baixo aparece por trás)
  ['.abertura', f => new Promise(ok => {
    animar(f, { opacity: 0, ...(f.classList.contains('vidro') ? {} : { scale: 1.04, filter: ['blur(0px)', 'blur(6px)'] }), duration: 480, ease: 'out(3)', onComplete: () => ok(null) });
  }), 'fixo'],
];
const TODAS_AS_SAIDAS = SAIDAS.map(s => s[0]).join(', ');

// fechou pelo Esc (teclado): sai na hora, sem animação (atalho de teclado não anima)
let ultimoEsc = -1e9;
function animarSeSaiu(no: Node, pai: Node, depois: Node | null) {
  if (!(no instanceof HTMLElement) || no.hasAttribute('data-fantasma') || performance.now() - ultimoEsc < 150) return;
  for (const [seletor, sair, onde] of SAIDAS) {
    const achados: HTMLElement[] = [];
    if (no.matches(seletor)) achados.push(no);
    else if (onde === 'fixo') no.querySelectorAll<HTMLElement>(seletor).forEach(x => achados.push(x));
    for (const el of achados) {
      // só o de fora (um menu dentro de uma janela sai junto com ela)
      if (el !== no && el.parentElement?.closest(TODAS_AS_SAIDAS)) continue;
      const f = el.cloneNode(true) as HTMLElement;
      f.setAttribute('data-fantasma', '');
      f.setAttribute('aria-hidden', 'true');
      f.setAttribute('inert', '');
      f.style.pointerEvents = 'none';
      // o que estava digitado nos campos (o clone só copia o atributo, não o valor de agora)
      const campos = el.querySelectorAll<HTMLInputElement>('input, textarea, select');
      f.querySelectorAll<HTMLInputElement>('input, textarea, select').forEach((c, i) => { if (campos[i]) c.value = campos[i].value; });
      if (onde === 'no-lugar') {
        if (!pai.isConnected) continue;
        pai.insertBefore(f, depois && depois.parentNode === pai ? depois : null);
      } else if (el === no && pai.isConnected) {
        pai.insertBefore(f, depois && depois.parentNode === pai ? depois : null);
      } else {
        document.body.appendChild(f);
      }
      void sair(f).then(() => f.remove());
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
    for (const m of lista) {
      m.removedNodes.forEach(no => animarSeSaiu(no, m.target, m.nextSibling));
      m.addedNodes.forEach(animarSeEntrou);
    }
  }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') ultimoEsc = performance.now(); }, true);
  document.addEventListener('pointerdown', apertar, true);
  document.addEventListener('pointerup', soltar, true);
  document.addEventListener('pointercancel', soltar, true);
}
