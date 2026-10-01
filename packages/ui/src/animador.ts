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
import { cleanInlineStyles, stagger } from 'animejs';
import { afundar, animar, celebrar, crescerDaOrigem, desenharCheck, ENTRAR, encerrarPaginas, entrar, marcarOrigem, MOLA_VIVA, origemDe, pegarOrigem, revelarTitulo, sairComo, semMovimento, voltar, voltarParaOrigem } from './animacao';

type Entrada = (el: HTMLElement) => void;

function alertaChegou(el: HTMLElement) {
  const ok = el.classList.contains('alert-ok') || (el.getAttribute('style') || '').includes('success');
  entrar('alerta', el, { mais: { clipPath: ['inset(0% 100% 0% 0% round 6px)', 'inset(0% 0% 0% 0% round 6px)'] } });
  animar(el.querySelectorAll(':scope > div > *'), { opacity: [0, 1], translateX: [-10, 0], delay: stagger(70, { start: 160 }), duration: 520, ease: ENTRAR,
    onComplete: a => { cleanInlineStyles(a); } });
  el.style.setProperty('--alerta-faixa', '0');
  animar(el, { '--alerta-faixa': 1, duration: 620, delay: 80, ease: ENTRAR } as never);
  const svg = el.querySelector<SVGSVGElement>(':scope > svg');
  if (!svg) return;
  if (ok && svg.querySelector('circle')) { celebrar(svg, false); return; }
  animar(svg, {
    opacity: [0, 1], scale: [0.5, 1], ease: MOLA_VIVA, delay: 120,
    rotate: [{ to: 0, duration: 380 }, { to: -16, duration: 90 }, { to: 12, duration: 110 }, { to: -6, duration: 110 }, { to: 0, duration: 160 }],
  });
}

// As telas flutuantes nascem de onde foram abertas (o botão, a linha, o ponto do clique direito) e voltam para lá ao
// fechar — a origem é marcada no clique (apertar, abaixo) e guardada em animacao.ts (marcarOrigem/pegarOrigem).
function janela(el: HTMLElement, caixa: HTMLElement | null) {
  encerrarPaginas();
  entrar('fundo', el);
  if (!caixa) return;
  if (!crescerDaOrigem(caixa, pegarOrigem(el))) entrar('janela', caixa);
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
    pegarOrigem(el);
    const pai = el.parentElement?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (pai) el.style.transformOrigin = (r.top >= pai.top ? 'top ' : 'bottom ') + (Math.abs(r.right - pai.right) < Math.abs(r.left - pai.left) ? 'right' : 'left');
    entrar('menu', el);
  }],
  // o menu do botão direito nasce no ponteiro (o canto de cima à esquerda)
  ['.ctx-menu', el => {
    encerrarPaginas();
    pegarOrigem(el);
    el.style.transformOrigin = 'top left';
    entrar('menu', el);
  }],
  ['#login', el => { entrar('login', el.querySelectorAll(':scope > *, .auth > *')); }],
  // o alerta: a caixa se abre da esquerda para a direita (o recorte, como o "Nilma" da abertura) enquanto desce; a
  // faixa colorida da esquerda cresce; o título e o texto chegam logo atrás; o ícone encaixa — o de atenção dá uma
  // balançada (chama o olho uma vez só) e o verde (deu certo) desenha o check
  ['.alert', el => { alertaChegou(el); }],
  ['.imp-aviso-barra, .drive-pedido, .liberar-aviso, .versao-nova, .envio-lista li, .meus-lista li', el => { entrar('alerta', el); }],
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
type Saida = (fantasma: HTMLElement, original?: HTMLElement) => Promise<unknown>;
const SAIDAS: [string, Saida, 'fixo' | 'no-lugar'][] = [
  ['.modal-overlay:not([data-saida-propria]), .cad-janela-fundo', (f, original) => {
    const caixa = (f.querySelector<HTMLElement>('.modal') || f.firstElementChild) as HTMLElement | null;
    // volta para onde foi aberta (o botão, a linha), encolhendo até o tamanho dela; sem origem, sai do jeito do app
    const volta = caixa && original ? voltarParaOrigem(caixa, origemDe(original)) : null;
    return Promise.all([sairComo('fundo', f), volta || (caixa ? sairComo('janela', caixa) : null)]);
  }, 'fixo'],
  ['.ctx-menu', (f, original) => (original && voltarParaOrigem(f, origemDe(original))) || sairComo('menu', f), 'fixo'],
  ['.popover', (f, original) => (original && voltarParaOrigem(f, origemDe(original))) || sairComo('menu', f), 'no-lugar'],
  // a abertura do app: some crescendo de leve e saindo do foco (a tela de baixo aparece por trás)
  ['.abertura', f => new Promise(ok => {
    animar(f, { opacity: 0, ...(f.classList.contains('vidro') ? {} : { scale: 1.04, filter: ['blur(0px)', 'blur(6px)'] }), duration: 480, ease: 'out(3)', onComplete: () => ok(null) });
  }), 'fixo'],
];
const TODAS_AS_SAIDAS = SAIDAS.map(s => s[0]).join(', ');

// Os botões que trocam de texto (Salvar → Salvando… → Salvo): o texto novo chega saindo de um desfoque de leve, em vez
// de trocar seco. Um botão que muda toda hora (uma contagem) não pisca: no máximo uma vez a cada 700 ms.
const trocados = new WeakMap<Element, number>();
function botaoTrocouDeTexto(no: Node) {
  const el = (no.nodeType === Node.TEXT_NODE ? no.parentElement : (no as Element))?.closest?.('.btn') as HTMLElement | null;
  if (!el || el.closest('[data-fantasma]') || semMovimento()) return;
  const agora = performance.now();
  if (agora - (trocados.get(el) || -1e9) < 700) return;
  trocados.set(el, agora);
  animar(el, { opacity: [0.5, 1], filter: ['blur(2px)', 'blur(0px)'], duration: 260, ease: ENTRAR, onComplete: a => { cleanInlineStyles(a); } });
}

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
      void sair(f, el).then(() => f.remove());
    }
  }
}

// o toque nos botões
const TOCAVEIS = '.btn:not(:disabled), .icon-btn:not(:disabled), .explorador-cmd:not(:disabled), .chip-f:not(:disabled), .step-pill, .gh-hamb';
let apertado: HTMLElement | null = null;
// o quique de recusa: clicou fora de uma janela que não fecha assim (tem algo a decidir) — ela dá um "não" de leve
function recusar(fundo: HTMLElement) {
  setTimeout(() => {
    if (!fundo.isConnected || fundo.hasAttribute('data-fantasma')) return;
    const caixa = (fundo.querySelector<HTMLElement>('.modal') || fundo.firstElementChild) as HTMLElement | null;
    if (caixa) animar(caixa, { scale: [{ to: 0.97, duration: 90, ease: 'out(2)' }, { to: 1, duration: 260, ease: MOLA_VIVA }] });
  }, 90);
}
function apertar(ev: PointerEvent) {
  const alvo0 = ev.target as Element | null;
  if (ev.button === 0 && alvo0) {
    // a origem de uma tela que abrir agora: a linha, o botão, o item clicado
    const de = alvo0.closest<HTMLElement>('tr.linha-abre, .linha-abre, button, a[href], [role="button"], [role="menuitem"], .drive-no');
    if (de) marcarOrigem({ el: de });
    // clicou fora de uma janela: se ela não fechar assim, dá o "não" de leve
    if (alvo0.matches('.cad-janela-fundo') || (alvo0.matches('.modal-overlay') && !alvo0.hasAttribute('data-fecha-fora'))) recusar(alvo0 as HTMLElement);
  }
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
      if (m.type === 'characterData') { botaoTrocouDeTexto(m.target); continue; }
      m.removedNodes.forEach(no => animarSeSaiu(no, m.target, m.nextSibling));
      m.addedNodes.forEach(animarSeEntrou);
      if (m.target instanceof Element && m.target.closest('.btn') && (m.addedNodes.length || m.removedNodes.length)) botaoTrocouDeTexto(m.target);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') ultimoEsc = performance.now(); }, true);
  // o clique direito: o menu nasce (e volta) no ponto do clique
  document.addEventListener('contextmenu', ev => { marcarOrigem({ ponto: { x: ev.clientX, y: ev.clientY } }); }, true);
  document.addEventListener('pointerdown', apertar, true);
  document.addEventListener('pointerup', soltar, true);
  document.addEventListener('pointercancel', soltar, true);
}
