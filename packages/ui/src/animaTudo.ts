// A camada do "Não tem motivo pra usar tanta animação" (Vitor, 15/10/2026: "quero que voce anime tudo do app, ele
// inteiro caso a opção 'Não tem motivo para tanta animação' estiver ativada, para realmente fazer jus ao nome, quero o
// mais bonito e fluido possivel, use o anime js"). Só nesse nível (tudoAnima); no Normal, na Nenhuma e nas Parciais nada
// daqui roda: o animador chama e volta na primeira linha. É global — nenhuma tela precisa lembrar: o animador passa cada
// lote do MutationObserver e os eventos do mouse e do teclado.
//   revelar    o que chega na tela (página nova, outra aba, os dados no lugar do esqueleto, uma linha nova): as caixas
//              (cartões, números, tabelas, painéis) em cascata na ordem de leitura e, dentro delas, as linhas logo atrás;
//              só o que está à vista — no máximo 14 linhas por grupo e 56 peças por vez (lista grande não trava)
//   deslizar   as linhas e os cartões que mudaram de lugar depois de um clique (ordenar, filtrar, tirar um, abrir um
//              detalhe) deslizam do lugar antigo ao novo, em vez de pular (FLIP: a foto é tirada no apertar, antes de o
//              React mexer; a posição é relativa à lista, então rolar a tela não confunde)
//   contar     os números grandes (.stat-value, o total da rosca) contam do zero ao aparecer e do antigo ao novo ao mudar
//              (a cada ~2 quadros, com a largura travada; fora da tela, direto o final)
//   barras     as barras dos gráficos crescem a partir da base; as roscas se desenham fatia por fatia
//   selos      o badge que muda (Pendente → Feito) dá um pulo; a aba ou seção que fica ativa faz o ícone quicar
//   marcar     a caixinha e o rádio marcados encaixam com mola
// Os extras das janelas e dos menus (o conteúdo chega em cascata depois da caixa) são chamados pelo animador.
// Regras da casa: só transform, opacity e filter (nada que mexa no tamanho dos outros); nunca escala 0; o que se digita
// não anima (digitando, a lista filtra parada); menos movimento no sistema: só o esmaecer; nada segura o clique (a peça
// chegando já é clicável); tudo que parte de opacidade 0 tem garantia (a aba em segundo plano para o relógio).
// Desempenho (otimizado em 15/10/2026, a pedido: "otimizar a camada animaTudo"): as entradas, as barras, os selos, os
// ícones e as linhas que deslizam vão pelo WAAPI (em transform/opacity/filter: o compositor anda sozinho, sem o motor JS a
// cada quadro; a mola do animejs vira a curva linear() do CSS). Terminou: a animação é só cancelada, sem gravar o fim no
// style (o adaptador waapi do animejs grava, commitStyles, e isso obrigava o navegador a recalcular a tela inteira no fim
// de cada peça: numa lista de 3.000 linhas, ~800 ms). No motor JS ficam só os números contando e o traço da rosca. Cada lote mede tudo antes de escrever, com as
// medidas guardadas no lote (medir); a foto do FLIP mede só as listas do lugar do clique. O passar do mouse é só CSS.
import { animate, type JSAnimation } from 'animejs';
import { acompanharEntrada, contarNumero, entradasFeitas, garantir, jeitoAtual, lerNumero, mola, prefereMenosMovimento, tudoAnima } from './animacao';

// ------------------------------------------------------------------ o que é o quê
/** Onde esta camada não mexe: quem anima a própria entrada (menus, gaveta, avisos, abertura, entrar), o carregamento. */
const FORA = [
  '[data-fantasma]', '[data-sem-animacao]', '[data-entrada-propria]', '.abertura', '#login', '.drawer', '.drawer-overlay',
  '.popover', '.ctx-menu', '.toast-region', '.alertas-topo', '.alertas-soltos', '.esqueleto', '.versao-trava', '.executor-fim',
  '.imp-aviso', '.explorador-soltar',
].join(', ');
/** As janelas: o que chega junto com elas é da entrada delas (cascataNaJanela). */
const JANELAS = '.modal-overlay, .cad-janela-fundo';
/** As caixas: chegam em cascata, na ordem de leitura. */
const CAIXAS = [
  '.card', '.stat', '.table-wrap', '.empty', '.gh-blank', '.gh-box', '.painel', '.cfg-secao', '.rank',
  '[class$="-cartao"]:not(.esqueleto-cartao)', '[class*="-cartao "]:not(.esqueleto-cartao)',
].join(', ');
/** As linhas: chegam logo atrás da caixa delas (ou em grupo, se estão soltas). */
const LINHAS = 'tbody > tr, li, .cfg-linha, .subnav-item, .menu-item, .caixa-item, .imp-linha, .step-pill';
/** O que junta as linhas num grupo (a cascata de cada um começa junto). */
const GRUPOS = 'tbody, ul, ol, .subnav-itens, .menu, .caixa-menu, .cfg-linhas, .steps';
/** Os números que contam (um texto só dentro, num bloco: contar não empurra o vizinho). */
const NUMEROS = '.stat-value, .cert-rosca-total';
/** As barras: as que crescem para o lado (o preenchimento com width) e as que sobem (as colunas). */
const BARRAS_X = '[class*="barra"]:not(.dp-barra):not(.andando) > span[style*="width"]';
const BARRAS_Y = '.chart-bar, .cert-barra-cheia';
/** As fatias das roscas (o traço do círculo: stroke-dasharray). */
const ROSCAS = 'svg circle[stroke-dasharray]';
/** O que serve de lista para as linhas que se movem (a foto do FLIP). */
const LISTAS = 'tbody, ul, ol, .stat-grid, .dash-grid';
/** As abas e seções: a que fica ativa faz o ícone quicar. */
const ABAS = '.menu-item, .subnav-item, .caixa-item';

/** As peças com uma entrada nossa rodando (pelo WAAPI: não aparece no style). */
const emEntrada = new WeakSet<Element>();
/** Alguém está animando a peça agora (ou o React pôs opacidade/transform nela): não mexe. */
const ocupada = (el: HTMLElement | SVGElement) => emEntrada.has(el) || !!(el.style.opacity || el.style.transform || el.style.filter || el.style.translate);

// ------------------------------------------------------------------ medir (uma vez por lote)
// As medidas do lote: cada peça é medida uma vez só, e todas antes de qualquer escrita (o lote começa e termina limpando).
let medidas = new Map<Element, DOMRect>();
const medir = (el: Element): DOMRect => {
  let r = medidas.get(el);
  if (!r) { r = el.getBoundingClientRect(); medidas.set(el, r); }
  return r;
};
const novoLote = () => { medidas = new Map(); };
const naTela = (r: DOMRect, folga = 0) => r.width > 0 && r.height > 0 && r.bottom >= -folga && r.top <= window.innerHeight + folga;

// ------------------------------------------------------------------ pelo compositor (WAAPI)
const ENTRAR_CSS = 'cubic-bezier(0.23, 1, 0.32, 1)';
/** Uma mola do animejs (spring) tem a curva e o tempo de assentar. */
type Mola = ReturnType<typeof mola>;
type Curva = string | Mola;
/** Uma propriedade: de → para, ou com o próprio tempo (a opacidade que acende antes de o movimento assentar). */
type Valor = [string | number, string | number] | { from: number; to: number; duration: number; ease: string };
/** O pedido de uma entrada: as propriedades (só opacity, transform, filter, translate) e o tempo. */
interface Quadros { opacity?: Valor; transform?: Valor; filter?: Valor; translate?: Valor; duration?: number; delay?: number; ease?: Curva }
const ehMola = (c: Curva | undefined): c is Mola => !!c && typeof c === 'object' && 'settlingDuration' in c;
/** A mola em curva do CSS: linear() com a forma dela, amostrada (40 pontos bastam para não se ver degrau). */
const linearDaMola = (m: Mola) => 'linear(' + Array.from({ length: 41 }, (_, i) => +m.ease(i / 40).toFixed(4)).join(', ') + ')';

/**
 * Uma entrada pelo WAAPI do navegador: só transform, opacity, filter e translate (o compositor anda sozinho). O de antes do
 * atraso já vale (fill: both: a peça não pisca). Terminou: a animação é cancelada sem gravar nada no style (o fim é o estado
 * natural da peça). Com garantia: passado o tempo (a aba em segundo plano não anda o relógio), termina na hora. Enquanto
 * roda, uma janela que abrir termina ela (acompanharEntrada: o transform prenderia o position:fixed de quem está dentro).
 */
let aCancelar: (() => void)[] = [];
let cancelarEm = 0;
function cancelarJuntas(): void {
  const lista = aCancelar;
  aCancelar = [];
  cancelarEm = 0;
  for (const c of lista) c();
}
function pelaGpu(el: HTMLElement | SVGElement, q: Quadros, ms: number, depois?: () => void): Animation[] {
  const atraso = q.delay ?? 0;
  const mol = ehMola(q.ease) ? q.ease : null;
  const duracao = mol ? mol.settlingDuration : (q.duration ?? 500);
  const curva = mol ? linearDaMola(mol) : (q.ease as string | undefined) ?? ENTRAR_CSS;
  const anims: Animation[] = [];
  for (const prop of ['opacity', 'transform', 'filter', 'translate'] as const) {
    const v = q[prop];
    if (!v) continue;
    const [de, para, t] = Array.isArray(v) ? [v[0], v[1], { duration: duracao, easing: curva }] : [v.from, v.to, { duration: v.duration, easing: v.ease }];
    anims.push(el.animate([{ [prop]: String(de) }, { [prop]: String(para) }], { ...t, delay: atraso, fill: 'both' }));
  }
  if (!anims.length) return anims;
  emEntrada.add(el);
  let acabou = false;
  const fim = () => {
    if (acabou) return;
    acabou = true;
    largar();
    emEntrada.delete(el);
    // (o fim parado no lugar, fill: both, é igual ao natural: cancelar junto com as outras que acabaram agora custa um
    // recálculo da tela só, não um por peça)
    aCancelar.push(() => { for (const a of anims) a.cancel(); depois?.(); });
    if (!cancelarEm) cancelarEm = window.setTimeout(cancelarJuntas, 250);
  };
  // (abriu uma janela: termina e sai na hora, sem esperar as outras — o transform prenderia o position:fixed)
  const terminar = () => { for (const a of anims) { try { a.finish(); } catch { /* já foi */ } } fim(); cancelarJuntas(); };
  const largar = acompanharEntrada(terminar);
  void Promise.all(anims.map(a => a.finished)).then(fim, () => { /* cancelada por outra: o fim já correu */ });
  window.setTimeout(() => { if (!acabou) terminar(); }, Math.max(1200, ms + 500));
  return anims;
}

// ------------------------------------------------------------------ digitando
// O que se digita não anima: enquanto a pessoa digita (até 600 ms depois da última tecla), as listas filtram paradas.
let ultimaTecla = -1e9;
const editavel = (el: EventTarget | null) => {
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return el instanceof HTMLInputElement && !['checkbox', 'radio', 'range', 'color', 'file', 'button', 'submit', 'reset'].includes(el.type);
};
const digitando = () => performance.now() - ultimaTecla < 600;

// ------------------------------------------------------------------ as receitas, por jeito
type Papel = 'caixa' | 'item';
const aparece = (ms: number) => ({ from: 0, to: 1, duration: ms, ease: 'linear' });
/** A entrada (os quadros do WAAPI) e quanto ela dura no máximo (para a garantia). */
function receita(papel: Papel, alta: boolean): { params: Quadros; ms: number } {
  // menos movimento no sistema: só o esmaecer
  if (prefereMenosMovimento()) return { params: { opacity: [0, 1], duration: 220, ease: 'linear' }, ms: 220 };
  const j = jeitoAtual();
  // a caixa muito alta (a tabela de 3.000 linhas) só acende: o primeiro transform muda quem segura os de dentro e o
  // navegador refaz a tela da caixa inteira (centenas de ms); as linhas dela, que estão à vista, é que se mexem
  if (papel === 'caixa' && alta) return { params: { opacity: [0, 1], duration: j === 'suave' ? 700 : 520, ease: 'linear' }, ms: 700 };
  if (papel === 'caixa') {
    if (j === 'viva') return { params: { opacity: aparece(260), transform: ['translateY(26px) scale(0.96)', 'none'], ease: mola(0.32, 700) }, ms: 1000 };
    if (j === 'suave') return { params: { opacity: [0, 1], transform: ['translateY(16px)', 'none'], duration: 820, ease: ENTRAR_CSS }, ms: 820 };
    // a marca: sai do desfoque, como o "Nilma" da abertura
    return { params: { opacity: [0, 1], transform: ['translateY(18px)', 'none'], filter: ['blur(6px)', 'blur(0px)'], duration: 700, ease: ENTRAR_CSS }, ms: 700 };
  }
  if (j === 'viva') return { params: { opacity: aparece(200), transform: ['translateY(14px)', 'none'], ease: mola(0.35, 600) }, ms: 900 };
  if (j === 'suave') return { params: { opacity: [0, 1], transform: ['translateY(8px)', 'none'], duration: 700, ease: ENTRAR_CSS }, ms: 700 };
  return { params: { opacity: [0, 1], transform: ['translateY(10px)', 'none'], filter: ['blur(3px)', 'blur(0px)'], duration: 560, ease: ENTRAR_CSS }, ms: 560 };
}

/** A chegada de uma peça (parte da opacidade 0: com garantia). */
function chegar(el: HTMLElement, papel: Papel, atraso: number, alta = false): void {
  revelados.add(el);
  const r = receita(papel, alta);
  pelaGpu(el, { ...r.params, delay: atraso }, atraso + r.ms);
}

// ------------------------------------------------------------------ à vista
/**
 * As peças que estão à vista, até `max`. Linhas de uma lista (emLista: a ordem do DOM é a da tela), se a lista é grande:
 * acha a primeira à vista por busca binária (sem medir as milhares de cima) e para na primeira que passou do fim da tela.
 */
function aVista(els: HTMLElement[], max: number, folga = 0, emLista = true): HTMLElement[] {
  const vh = window.innerHeight;
  const emOrdem = emLista && els.length > 30;
  let ini = 0;
  if (emOrdem) {
    let lo = 0, hi = els.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (medir(els[m]).bottom < -folga) lo = m + 1; else hi = m; }
    ini = lo;
  }
  const out: HTMLElement[] = [];
  for (let i = ini; i < els.length && out.length < max; i++) {
    const r = medir(els[i]);
    if (r.top > vh + folga) { if (emOrdem) break; continue; }
    if (r.bottom < -folga || r.width === 0 || r.height === 0) continue;
    out.push(els[i]);
  }
  return out;
}
/** Ordem de leitura: de cima para baixo (com 8 px de tolerância) e da esquerda para a direita. */
function ordemDeLeitura(els: HTMLElement[]): HTMLElement[] {
  const pos = new Map(els.map(el => { const r = medir(el); return [el, { y: Math.round(r.top / 8), x: r.left }] as const; }));
  return els.slice().sort((a, b) => pos.get(a)!.y - pos.get(b)!.y || pos.get(a)!.x - pos.get(b)!.x);
}

// ------------------------------------------------------------------ revelar
const revelados = new WeakSet<Element>();
/** As janelas que acabaram de abrir (o conteúdo delas é da entrada delas). */
const janelasAbertas = new WeakMap<Element, number>();
/**
 * O que muda o tempo todo (um painel ao vivo que se redesenha a cada segundo) não pode ficar piscando: o mesmo lugar
 * que recebeu mais de 4 entradas em 5 s fica quieto por 20 s.
 */
const agitacao = new WeakMap<Element, { n: number; desde: number; calmoAte: number }>();
function agitado(lugar: Element): boolean {
  const agora = performance.now();
  let a = agitacao.get(lugar);
  if (!a || agora - a.desde > 5000) { a = { n: 0, desde: agora, calmoAte: a?.calmoAte ?? 0 }; agitacao.set(lugar, a); }
  if (agora < a.calmoAte) return true;
  if (++a.n > 4) { a.calmoAte = agora + 20000; return true; }
  return false;
}
function podeRevelar(el: HTMLElement, agora: number): boolean {
  if (revelados.has(el) || entradasFeitas.has(el) || foto.has(el) || ocupada(el) || el.closest(FORA)) return false;
  const j = el.closest(JANELAS);
  return !(j && agora - (janelasAbertas.get(j) ?? -1e9) < 700);
}

const MAXIMO = 56;
const POR_GRUPO = 14;

/**
 * O que vai acontecer: medido antes e escrito depois, tudo de uma vez (medir depois de escrever força o navegador a
 * recalcular a tela a cada peça — numa lista de 3.000 linhas isso levava 400 ms).
 */
interface Plano {
  chegadas: { el: HTMLElement; papel: Papel; atraso: number; alta: boolean }[];
  contas: { t: Text; atraso: number; caixa: DOMRect }[];
  barras: { el: HTMLElement; eixo: 'x' | 'y'; atraso: number }[];
  fatias: { el: SVGCircleElement; atraso: number }[];
}

/** O lote de peças que entraram no DOM (as raízes): o que estiver à vista chega em cascata. */
function revelar(raizes: HTMLElement[]): void {
  const agora = performance.now();
  const pediu = agora - fotoEm < 1500;
  // as janelas que chegaram agora: o conteúdo delas é da entrada delas
  for (const r of raizes) {
    if (r.matches(JANELAS)) janelasAbertas.set(r, agora);
    r.querySelectorAll(JANELAS).forEach(j => janelasAbertas.set(j, agora));
  }
  const caixas: HTMLElement[] = [];
  const linhas: HTMLElement[] = [];
  const soltas: HTMLElement[] = [];
  const lugares = new Set<Element>();
  for (const r of raizes) {
    if (r.closest(FORA) || !r.isConnected) continue;
    const lugar = r.parentElement;
    if (!lugar) continue;
    // o mesmo lugar conta uma vez por lote (o React põe as 50 linhas de uma vez, cada uma numa mudança); o que veio de
    // um clique ou tecla de agora há pouco não conta (quem anda rápido pelas abas vê tudo animado)
    if (!lugares.has(lugar)) { lugares.add(lugar); if (!pediu && agitado(lugar)) continue; } else if ((agitacao.get(lugar)?.calmoAte ?? 0) > agora) continue;
    const ehCaixa = r.matches(CAIXAS);
    const ehLinha = !ehCaixa && r.matches(LINHAS);
    if (ehCaixa) caixas.push(r);
    if (ehLinha) linhas.push(r);
    const cs = r.querySelectorAll<HTMLElement>(CAIXAS);
    const ls = r.querySelectorAll<HTMLElement>(LINHAS);
    cs.forEach(c => caixas.push(c));
    ls.forEach(l => linhas.push(l));
    if (!ehCaixa && !ehLinha && !cs.length && !ls.length) soltas.push(r);
  }
  const plano: Plano = { chegadas: [], contas: [], barras: [], fatias: [] };

  // as caixas à vista; as de fora (sem caixa em volta) mandam na cascata, as de dentro vão como as linhas delas
  const caixasVistas = aVista(caixas.length > 300 ? caixas.slice(0, 300) : caixas, 40, 0, false).filter(c => podeRevelar(c, agora));
  const vistas = new Set(caixasVistas);
  const donoDe = (el: HTMLElement): HTMLElement | null => {
    for (let p = el.parentElement; p; p = p.parentElement) if (vistas.has(p)) return p;
    return null;
  };
  const externas = ordemDeLeitura(caixasVistas.filter(c => !donoDe(c))).slice(0, 18);
  const atrasoDe = new Map<HTMLElement, number>();
  const passo = externas.length > 1 ? Math.min(70, 480 / (externas.length - 1)) : 0;
  externas.forEach((c, i) => { atrasoDe.set(c, i * passo); plano.chegadas.push({ el: c, papel: 'caixa', atraso: i * passo, alta: medir(c).height > 360 }); });

  // as linhas (e as caixas de dentro), por grupo; à vista, até 14 por grupo. A linha que está dentro de outra linha do
  // mesmo lote (a lista dentro da linha da tabela) vem com ela: não anima de novo. O grupo se acha pelo pai (o mesmo
  // pai, o mesmo grupo: uma busca por pai, não por linha).
  const daLista = new Set(linhas);
  const grupoDoPai = new Map<Element, Element | null>();
  const porGrupo = new Map<Element, HTMLElement[]>();
  for (const el of [...caixasVistas.filter(c => donoDe(c)), ...linhas]) {
    const pai = el.parentElement;
    if (!pai) continue;
    let g = grupoDoPai.get(pai);
    if (g === undefined) {
      const linhaEmVolta = pai.closest<HTMLElement>(LINHAS);
      g = linhaEmVolta && daLista.has(linhaEmVolta) ? null : pai.closest(GRUPOS) || pai;
      grupoDoPai.set(pai, g);
    }
    if (!g) continue;
    let l = porGrupo.get(g);
    if (!l) { l = []; porGrupo.set(g, l); }
    l.push(el);
  }
  let soltosAntes = 0;
  const semDono: HTMLElement[] = [];
  for (const [g, grupo] of porGrupo) {
    if (plano.chegadas.length >= MAXIMO) break;
    // a lista inteira fora da tela: nem mede as linhas dela
    if (!naTela(medir(g))) continue;
    const vistos = aVista(grupo, POR_GRUPO).filter(el => podeRevelar(el, agora));
    if (!vistos.length) continue;
    const dono = donoDe(vistos[0]);
    // dentro de uma caixa: começa logo depois dela; solto: os grupos se seguem
    const inicio = dono ? (atrasoDe.get(dono) ?? 0) + 110 : Math.min(400, soltosAntes++ * 80);
    const p = vistos.length > 1 ? Math.min(40, 360 / (vistos.length - 1)) : 0;
    for (let i = 0; i < vistos.length && plano.chegadas.length < MAXIMO; i++) {
      atrasoDe.set(vistos[i], inicio + i * p);
      plano.chegadas.push({ el: vistos[i], papel: 'item', atraso: inicio + i * p, alta: false });
      if (!dono) semDono.push(vistos[i]);
    }
  }

  // o que chegou sem ser caixa nem linha (um bloco que apareceu: o detalhe que abriu, a mensagem embaixo do campo)
  for (const s of soltas) {
    if (plano.chegadas.length >= MAXIMO) break;
    if (s.closest('button, a, label, .btn, td, th') || !podeRevelar(s, agora)) continue;
    const cs = getComputedStyle(s);
    if (cs.display.startsWith('inline') || cs.display === 'contents' || cs.position === 'fixed' || cs.position === 'absolute') continue;
    if (!aVista([s], 1).length || medir(s).height > 600) continue;
    atrasoDe.set(s, 0);
    plano.chegadas.push({ el: s, papel: 'item', atraso: 0, alta: false });
    semDono.push(s);
  }

  // os números contam, as barras crescem e as roscas se desenham: os de dentro do que acabou de chegar, à vista
  for (const el of [...externas, ...semDono]) {
    const base = (atrasoDe.get(el) ?? 0) + 120;
    const nums = el.matches(NUMEROS) ? [el] : aVista(Array.from(el.querySelectorAll<HTMLElement>(NUMEROS)), 16, 0, false);
    nums.forEach((n, i) => { const t = textoUnico(n); if (t && numeroEmBloco(n)) plano.contas.push({ t, atraso: base + i * 40, caixa: medir(n) }); });
    aVista(Array.from(el.querySelectorAll<HTMLElement>(BARRAS_X)), 24).forEach((b, i) => plano.barras.push({ el: b, eixo: 'x', atraso: base + 60 + i * 35 }));
    aVista(Array.from(el.querySelectorAll<HTMLElement>(BARRAS_Y)), 24, 0, false).forEach((b, i) => plano.barras.push({ el: b, eixo: 'y', atraso: base + 60 + i * 35 }));
    Array.from(el.querySelectorAll<SVGCircleElement>(ROSCAS)).slice(0, 12).forEach((c, i) => plano.fatias.push({ el: c, atraso: base + 80 + i * 110 }));
  }

  // agora sim, escreve (nada mais é medido daqui para baixo)
  for (const c of plano.chegadas) chegar(c.el, c.papel, c.atraso, c.alta);
  for (const c of plano.contas) contarTexto(c.t, 0, c.atraso, c.caixa);
  for (const b of plano.barras) crescerBarra(b.el, b.eixo, b.atraso);
  for (const f of plano.fatias) desenharFatia(f.el, f.atraso);
}

// ------------------------------------------------------------------ contar
const escritos = new WeakMap<Text, string>();
const contando = new WeakMap<Text, JSAnimation>();
/** O texto do número, quando ele é o único filho do elemento (o React escreve nele: a conta escreve no mesmo nó). */
function textoUnico(el: Element): Text | null {
  const t = el.firstChild;
  return t && t === el.lastChild && t.nodeType === Node.TEXT_NODE ? (t as Text) : null;
}
/** Só num bloco (ou no texto do SVG): mudar a largura do número enquanto conta não empurra ninguém. */
const numeroEmBloco = (el: Element) => el instanceof SVGElement || !getComputedStyle(el).display.startsWith('inline');
/** O nó é nosso (a conta acabou de escrever nele): a mudança não é do React. */
const escritoPelaConta = (t: Text) => escritos.get(t) === t.data;

/**
 * Conta do `de` até o número que está no texto agora (o final, já escrito pelo React); o React mudou no meio: para. A conta
 * é a do contarNumero (a cada ~2 quadros, largura travada, fora da tela direto o final). `caixa`: já medido no lote (e já
 * se sabe que é um bloco).
 */
function contarTexto(t: Text, de: number, atraso = 0, caixa?: DOMRect): void {
  const final = t.data;
  const n = lerNumero(final);
  const el = t.parentElement;
  if (!n || !el || Math.abs(n.valor - de) < 1e-9 || prefereMenosMovimento()) return;
  if (!caixa && !numeroEmBloco(el)) return;
  contando.get(t)?.pause();
  const fmt = (x: number) => n.antes + x.toLocaleString('pt-BR', { minimumFractionDigits: n.casas, maximumFractionDigits: n.casas }) + n.depois;
  const a = contarNumero(el, de, n.valor, (x, fim) => { const s = fim ? final : fmt(x); escritos.set(t, s); t.data = s; },
    { atraso, caixa, seguir: () => escritoPelaConta(t) });
  if (a) contando.set(t, a);
}

// ------------------------------------------------------------------ barras e roscas
/** A barra cresce da base (para o lado, ou para cima): escala, não largura — os vizinhos não sentem. */
function crescerBarra(b: HTMLElement, eixo: 'x' | 'y', atraso: number): void {
  if (revelados.has(b) || ocupada(b) || prefereMenosMovimento()) return;
  revelados.add(b);
  const origem = b.style.transformOrigin;
  b.style.transformOrigin = eixo === 'x' ? 'left center' : 'center bottom';
  const viva = jeitoAtual() === 'viva';
  const ms = jeitoAtual() === 'suave' ? 1100 : 900;
  pelaGpu(b, {
    transform: [eixo === 'x' ? 'scaleX(0.02)' : 'scaleY(0.02)', 'none'], delay: atraso,
    ...(viva ? { ease: mola(0.3, 800) } : { duration: ms, ease: ENTRAR_CSS }),
  }, atraso + ms, () => { b.style.transformOrigin = origem; });
}

/** A fatia da rosca se desenha: o traço vai de zero até o tamanho dela (o React mudou o traço no meio: para). */
function desenharFatia(c: SVGCircleElement, atraso: number): void {
  if (revelados.has(c) || prefereMenosMovimento()) return;
  const final = c.getAttribute('stroke-dasharray') || '';
  const m = /^\s*([\d.]+)[\s,]+([\d.]+)\s*$/.exec(final);
  if (!m) return;
  revelados.add(c);
  const cheio = parseFloat(m[1]), volta = cheio + parseFloat(m[2]);
  let escrito = '0 ' + volta;
  c.setAttribute('stroke-dasharray', escrito);
  const v = { x: 0 };
  const a = animate(v, {
    x: cheio, delay: atraso, duration: jeitoAtual() === 'suave' ? 1100 : 900, ease: 'out(4)',
    onUpdate: () => {
      if (c.getAttribute('stroke-dasharray') !== escrito) { a.pause(); return; }
      escrito = v.x + ' ' + (volta - v.x);
      c.setAttribute('stroke-dasharray', escrito);
    },
    onComplete: () => { if (c.getAttribute('stroke-dasharray') === escrito) c.setAttribute('stroke-dasharray', final); },
  });
  garantir(a, atraso + 1100, false);
}

// ------------------------------------------------------------------ deslizar (FLIP)
// A foto: onde cada linha (e cartão de uma grade) à vista estava, relativa à lista dela, no apertar do mouse (ou no
// Enter/espaço, ou ao escolher num select). Vale 2,5 s: o que mudou de lugar nesse tempo desliza do lugar antigo.
const foto = new Map<HTMLElement, { lista: HTMLElement; x: number; y: number }>();
const listasDaFoto = new Set<Element>();
let fotoEm = -1e9;
const deslizando = new WeakMap<HTMLElement, Animation>();
const FORA_DO_FLIP = '[data-linhas-proprias], [data-fantasma], [data-sem-animacao], .popover, .ctx-menu, .drawer, .abertura';

/** O bloco do controle (o select, a aba, o cabeçalho da tabela, o filtro): as listas dele são as que podem se mexer. */
const BLOCO_DO_CLIQUE = '.card, section, [role="dialog"], .modal, .content';
/**
 * A foto: só as listas do lugar do clique — as que estão em volta do alvo (a linha, o item) e as do mesmo bloco dele (o
 * card ou a seção: o filtro e a tabela que ele filtra) —, e só as linhas à vista. Só lê (nada é escrito aqui).
 */
function fotografar(alvo: EventTarget | null): void {
  foto.clear();
  listasDaFoto.clear();
  fotoEm = performance.now();
  if (!(alvo instanceof Element)) return;
  novoLote();
  const listas = new Set<HTMLElement>();
  for (let l = alvo.closest<HTMLElement>(LISTAS); l; l = l.parentElement?.closest<HTMLElement>(LISTAS) ?? null) listas.add(l);
  const bloco = alvo.closest(BLOCO_DO_CLIQUE);
  if (bloco) for (const l of Array.from(bloco.querySelectorAll<HTMLElement>(LISTAS)).slice(0, 40)) listas.add(l);
  for (const lista of listas) {
    if (lista.childElementCount < 2 || lista.closest(FORA_DO_FLIP)) continue;
    const r = medir(lista);
    if (!naTela(r)) continue;
    listasDaFoto.add(lista);
    for (const f of aVista(Array.from(lista.children) as HTMLElement[], 80, 200)) {
      const fr = medir(f);
      foto.set(f, { lista, x: fr.left - r.left, y: fr.top - r.top });
    }
  }
  novoLote();
}

/** Depois do lote de mudanças: o que estava na foto e mudou de lugar (dentro de uma lista que mexeu) desliza. */
function deslizar(mexidas: Set<Element>): void {
  // (menos movimento no sistema: as linhas vão direto para o lugar)
  if (!foto.size || performance.now() - fotoEm > 2500 || prefereMenosMovimento()) return;
  const vh = window.innerHeight;
  const j = jeitoAtual();
  const ms = j === 'suave' ? 700 : 520;
  // o que já estava deslizando volta para o lugar de verdade antes de medir
  const daqui = Array.from(foto).filter(([el, antes]) => mexidas.has(antes.lista) && el.isConnected && el.parentElement === antes.lista);
  for (const [el] of daqui) { deslizando.get(el)?.cancel(); deslizando.delete(el); }
  // primeiro mede tudo...
  const mover: [HTMLElement, number, number][] = [];
  for (const [el, antes] of daqui) {
    const lr = medir(antes.lista);
    const r = medir(el);
    const x = r.left - lr.left, y = r.top - lr.top;
    const dx = antes.x - x, dy = antes.y - y;
    antes.x = x; antes.y = y;
    if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || r.bottom < -200 || r.top > vh + 200) continue;
    // um transform prende o position:fixed de dentro: com uma janela ou menu aberto dentro, pula
    if (el.querySelector('.modal-overlay, .cad-janela-fundo, .popover, .ctx-menu')) continue;
    mover.push([el, dx, dy]);
  }
  for (const [el, antes] of foto) if (mexidas.has(antes.lista) && (!el.isConnected || el.parentElement !== antes.lista)) foto.delete(el);
  // ...depois escreve
  for (const [el, dx, dy] of mover) {
    const curva = j === 'viva' ? mola(0.25, 600) : 'cubic-bezier(0.77, 0, 0.175, 1)';
    const anim = el.animate([{ translate: dx + 'px ' + dy + 'px' }, { translate: '0px 0px' }],
      { duration: ehMola(curva) ? curva.settlingDuration : ms, easing: ehMola(curva) ? linearDaMola(curva) : curva, fill: 'both' });
    deslizando.set(el, anim);
    const fim = () => { if (deslizando.get(el) === anim) { deslizando.delete(el); anim.cancel(); } };
    void anim.finished.then(fim, () => { /* outra foto cancelou: tudo bem */ });
    // a aba em segundo plano não anda o relógio das animações: passado o tempo, a linha vai para o lugar
    window.setTimeout(fim, ms + 800);
  }
}

// ------------------------------------------------------------------ selos, abas e caixinhas
const ultimoPulo = new WeakMap<Element, number>();
/** O selo que mudou dá um pulo (no máximo um a cada 450 ms). */
function pular(el: HTMLElement): void {
  const agora = performance.now();
  if (prefereMenosMovimento() || agora - (ultimoPulo.get(el) ?? -1e9) < 450 || ocupada(el) || el.closest(FORA)) return;
  ultimoPulo.set(el, agora);
  pelaGpu(el, { transform: ['scale(0.78)', 'none'], filter: ['blur(2px)', 'blur(0px)'], ease: mola(0.55, 520) }, 800);
}
/** O ícone da aba que ficou ativa quica (sozinho: o item não se mexe, só o desenho dentro dele). */
function quicarIcone(item: Element): void {
  const svg = item.querySelector<SVGElement>(':scope > svg');
  if (!svg || prefereMenosMovimento() || ocupada(svg)) return;
  pelaGpu(svg, { transform: ['scale(0.72) rotate(-14deg)', 'none'], ease: mola(0.55, 620) }, 900);
}
function marcou(ev: Event): void {
  const el = ev.target;
  if (!(el instanceof HTMLInputElement) || (el.type !== 'checkbox' && el.type !== 'radio') || prefereMenosMovimento() || ocupada(el)) return;
  pelaGpu(el, { transform: [el.checked ? 'scale(0.7)' : 'scale(0.88)', 'none'], ease: mola(el.checked ? 0.6 : 0.3, 480) }, 800);
}

// ------------------------------------------------------------------ janelas e menus (chamados pelo animador)
/** O conteúdo da janela chega em cascata, logo depois da caixa (os campos, as linhas, as seções). */
export function cascataNaJanela(caixa: HTMLElement): void {
  if (!tudoAnima() || document.hidden) return;
  novoLote();
  const pecas = aVista(Array.from(caixa.querySelectorAll<HTMLElement>('.field, .cfg-linha, .card, .stat, tbody > tr, li, .modal-actions > .btn, .alert')), 16)
    .filter(el => !ocupada(el) && !el.closest('.popover, [data-entrada-propria]'));
  const p = pecas.length > 1 ? Math.min(45, 380 / (pecas.length - 1)) : 0;
  novoLote();
  pecas.forEach((el, i) => {
    revelados.add(el);
    const r = receita('item', false);
    pelaGpu(el, { ...r.params, delay: 220 + i * p }, 220 + i * p + r.ms);
  });
}
/** Os itens do menu chegam um atrás do outro (como o menu do avatar). */
export function cascataNoMenu(menu: HTMLElement): void {
  if (!tudoAnima() || document.hidden || prefereMenosMovimento()) return;
  const itens = Array.from(menu.querySelectorAll<HTMLElement>('.popover-item, .popover-sep, .seletor-mes-item, li')).slice(0, 14);
  itens.forEach((el, i) => {
    revelados.add(el);
    pelaGpu(el, { opacity: [0, 1], transform: ['translateX(-8px)', 'none'], duration: 300, delay: 50 + i * 28, ease: 'cubic-bezier(0.22, 1, 0.36, 1)' }, 50 + i * 28 + 300);
  });
}

// ------------------------------------------------------------------ a entrada (o animador chama)
/** Um lote do MutationObserver do animador. */
export function animarLote(lista: MutationRecord[]): void {
  if (!tudoAnima()) return;
  novoLote();
  const quieto = digitando() || document.hidden;
  const raizes: HTMLElement[] = [];
  const mexidas = new Set<Element>();
  for (const m of lista) {
    if (m.type === 'characterData') {
      const t = m.target as Text;
      if (escritoPelaConta(t) || quieto) continue;
      const el = t.parentElement;
      if (!el) continue;
      if (el.matches(NUMEROS)) { const antes = lerNumero(m.oldValue || ''); if (antes) contarTexto(t, antes.valor); }
      const selo = el.closest<HTMLElement>('.badge');
      if (selo) pular(selo);
      marcarMexida(t, mexidas);
      continue;
    }
    if (m.type !== 'childList') continue;
    marcarMexida(m.target, mexidas);
    if (quieto) continue;
    m.addedNodes.forEach(no => {
      if (!(no instanceof HTMLElement) || !no.isConnected) return;
      // um selo trocado (o React trocou o badge de Pendente pelo de Feito) pula
      if (no.matches('.badge') && !revelados.has(no)) { pular(no); return; }
      raizes.push(no);
    });
    // o texto do selo trocou (texto novo, não o mesmo nó)
    const selo = m.target instanceof Element ? m.target.closest<HTMLElement>('.badge') : null;
    if (selo) pular(selo);
  }
  if (!quieto) deslizar(mexidas);
  // (o deslizar escreveu: as medidas de antes não valem mais)
  novoLote();
  // as raízes de dentro de outra raiz do mesmo lote já vêm com ela
  const unicas = raizes.filter(r => !raizes.some(o => o !== r && o.contains(r)));
  if (unicas.length) revelar(unicas);
  novoLote();
}
/** As listas da foto que tiveram alguma mudança dentro delas (uma linha a mais, um detalhe que abriu numa linha). */
function marcarMexida(no: Node, mexidas: Set<Element>): void {
  if (!listasDaFoto.size) return;
  for (let p: Node | null = no; p && p !== document.body; p = p.parentNode) if (listasDaFoto.has(p as Element)) mexidas.add(p as Element);
}

/** As mudanças de classe (o observador de atributos do animador): o selo que mudou de tom pula; a aba ativa quica. */
export function classesMudaram(lista: MutationRecord[]): void {
  if (!tudoAnima() || document.hidden) return;
  for (const m of lista) {
    const el = m.target;
    if (!(el instanceof HTMLElement)) continue;
    const antes = ' ' + (m.oldValue || '') + ' ';
    if (el.classList.contains('badge') && antes !== ' ' + el.className + ' ') pular(el);
    else if (el.classList.contains('active') && !antes.includes(' active ') && el.matches(ABAS)) quicarIcone(el);
  }
}

let ligado = false;
/** Os eventos (uma vez, pelo animador): a tecla (digitando), a foto do FLIP e as caixinhas. */
export function ligarAnimaTudo(): void {
  if (ligado || typeof document === 'undefined') return;
  ligado = true;
  document.addEventListener('keydown', ev => {
    if (editavel(ev.target)) { ultimaTecla = performance.now(); return; }
    if (tudoAnima() && (ev.key === 'Enter' || ev.key === ' ')) fotografar(ev.target);
  }, true);
  document.addEventListener('input', ev => { if (editavel(ev.target)) ultimaTecla = performance.now(); }, true);
  document.addEventListener('pointerdown', ev => { if (ev.button === 0 && tudoAnima()) fotografar(ev.target); }, true);
  document.addEventListener('change', ev => {
    if (!tudoAnima()) return;
    marcou(ev);
    if (ev.target instanceof HTMLSelectElement) fotografar(ev.target);
  }, true);
}
