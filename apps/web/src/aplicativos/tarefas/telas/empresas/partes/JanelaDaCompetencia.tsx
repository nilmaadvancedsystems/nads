// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"). Volta do
// executor ou da página da empresa (a competência no endereço): não pergunta de novo.
// No formato de régua (Vitor, 05/10/2026: "só com ano e mês, o usuário usa o scroll para rolar o que ele quer"): duas
// faixas, Ano e Mês, que andam de lado de um em um (a rodinha do mouse também), deslizando; o do meio é o escolhido, em vermelho. Sem
// título e sem o Selecionar: dois cliques (ou Enter) abrem. Só de 2026 para frente e só os meses que já começaram.
import { classeDaJanela, Icone } from '@nads/ui';
import { animate, spring, stagger, utils } from 'animejs';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// As animações desta janela são pedido do Vitor (05/10/2026: "use o animejs para animar a entrada dessa seleção e a parte
// de selecionar também"): valem mesmo no nível Normal de animações; quem pediu menos movimento no computador não vê.
const menosMovimento = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
/** antes disso, nada (o sistema começou em 2026) */
const PRIMEIRO_ANO = 2026;

interface ItemDoRolo { valor: string; texto: string }

/**
 * Uma régua que anda de um em um (Vitor, 05/10/2026: "trave o scroll lateral, adicione uma animação nessa rolagem, para
 * parecer algo suave"): não rola solta; cada passo da rodinha (ou seta do teclado, ou clique) leva o item seguinte para o
 * meio, deslizando. O do meio é o escolhido; dois cliques (ou Enter) abrem.
 */
function Rolo({ rotulo, itens, valor, foco, onEscolher, onAbrir }: {
  rotulo: string; itens: ItemDoRolo[]; valor: string; foco?: boolean; onEscolher: (v: string) => void; onAbrir: (v: string) => void;
}) {
  const janela = useRef<HTMLDivElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const [deslocamento, setDeslocamento] = useState<number | null>(null);
  // a primeira posição vai direto (sem deslizar desde o começo da régua); depois o trilho anda com mola (animejs)
  const centrou = useRef(false);
  const i = itens.findIndex(x => x.valor === valor);
  const passo = (d: number) => { const n = i + d; if (n >= 0 && n < itens.length) onEscolher(itens[n].valor); };
  // o escolhido no meio da janela (de novo quando a janela muda de largura: na primeira vez ela ainda pode estar com 0)
  useLayoutEffect(() => {
    const box = janela.current;
    if (!box) return;
    const centralizar = () => {
      const el = trilho.current?.querySelector<HTMLElement>('[data-valor="' + valor + '"]');
      if (!el || !box.clientWidth) return;
      setDeslocamento(box.clientWidth / 2 - (el.offsetLeft + el.offsetWidth / 2));
    };
    centralizar();
    const ro = new ResizeObserver(centralizar);
    ro.observe(box);
    return () => ro.disconnect();
  }, [valor, itens.length]);
  // a roda (Vitor, 05/10/2026: "melhore a seleção de mês"): o do meio grande e forte, os vizinhos diminuem e apagam
  // conforme se afastam — recalculado a cada quadro enquanto o trilho anda, então a troca é contínua
  const atual = useRef(0);
  const pintar = (x: number) => {
    const box = janela.current;
    const t = trilho.current;
    if (!box || !t) return;
    atual.current = x;
    const meio = box.clientWidth / 2;
    for (const el of Array.from(t.children) as HTMLElement[]) {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 + x - meio) / el.offsetWidth;
      el.style.transform = 'scale(' + Math.max(0.7, 1.32 - d * 0.3).toFixed(3) + ')';
      el.style.opacity = Math.max(0.15, 1 - d * 0.38).toFixed(3);
    }
  };
  const mover = (x: number, comMola: boolean) => {
    const t = trilho.current;
    if (!t) return;
    if (!comMola || menosMovimento()) { utils.set(t, { translateX: x }); pintar(x); return; }
    const de = { x: atual.current };
    animate(de, { x, ease: spring({ bounce: 0.22, duration: 480 }), onUpdate: () => { utils.set(t, { translateX: de.x }); pintar(de.x); } });
  };
  // o trilho até o escolhido: a primeira vez no lugar; depois deslizando com mola
  useLayoutEffect(() => {
    if (deslocamento == null) return;
    mover(deslocamento, centrou.current);
    centrou.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deslocamento]);
  // arrastar a régua com o mouse (ou o dedo): ela segue o arraste e, ao soltar, encaixa no mês mais perto
  const arraste = useRef<{ x0: number; base: number; moveu: boolean } | null>(null);
  // o clique que vem junto com o soltar de um arraste não escolhe nada
  const arrastouEm = useRef(0);
  const soltar = () => {
    const a = arraste.current;
    arraste.current = null;
    if (!a?.moveu) return;
    arrastouEm.current = performance.now();
    const box = janela.current;
    const t = trilho.current;
    if (!box || !t) return;
    const meio = box.clientWidth / 2;
    let melhor = i;
    let menor = Infinity;
    (Array.from(t.children) as HTMLElement[]).forEach((el, k) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 + atual.current - meio);
      if (d < menor) { menor = d; melhor = k; }
    });
    if (melhor !== i) onEscolher(itens[melhor].valor);
    else if (deslocamento != null) mover(deslocamento, true);
  };
  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    if (menosMovimento()) return;
    const marca = janela.current?.querySelector<HTMLElement>('.comp-rolo-marca');
    if (marca) animate(marca, { scaleY: [1.9, 1], ease: spring({ bounce: 0.35, duration: 380 }) });
  }, [valor]);
  // a rodinha (e o trackpad): um item por passo, sem deixar a régua rolar solta
  const passoRef = useRef(passo);
  passoRef.current = passo;
  useEffect(() => {
    const box = janela.current;
    if (!box) return;
    let acumulado = 0;
    let parado = 0;
    const naRodinha = (e: WheelEvent) => {
      e.preventDefault();
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (performance.now() < parado) return;
      acumulado += d;
      if (Math.abs(acumulado) < 40) return;
      passoRef.current(acumulado > 0 ? 1 : -1);
      acumulado = 0;
      parado = performance.now() + 120;
    };
    box.addEventListener('wheel', naRodinha, { passive: false });
    return () => box.removeEventListener('wheel', naRodinha);
  }, []);
  return (
    <div className="comp-rolo-bloco">
      <span className="comp-rolo-rotulo">{rotulo}</span>
      <div ref={janela} className="comp-rolo" role="listbox" aria-label={rotulo} tabIndex={0} autoFocus={foco}
        onPointerDown={e => { if (e.button === 0) arraste.current = { x0: e.clientX, base: atual.current, moveu: false }; }}
        onPointerMove={e => {
          const a = arraste.current;
          if (!a) return;
          const dx = e.clientX - a.x0;
          if (!a.moveu && Math.abs(dx) < 5) return;
          if (!a.moveu) { a.moveu = true; e.currentTarget.setPointerCapture(e.pointerId); }
          utils.set(trilho.current!, { translateX: a.base + dx });
          pintar(a.base + dx);
        }}
        onPointerUp={soltar} onPointerCancel={soltar}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { e.preventDefault(); passo(1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); passo(-1); }
          if (e.key === 'Enter') { e.preventDefault(); onAbrir(valor); }
        }}>
        <div ref={trilho} className="comp-rolo-trilho">
          {itens.map(x => (
            <button key={x.valor} type="button" data-valor={x.valor} role="option" aria-selected={x.valor === valor} tabIndex={-1}
              className={'comp-rolo-item' + (x.valor === valor ? ' on' : '')} onClick={() => { if (performance.now() - arrastouEm.current > 250) onEscolher(x.valor); }} onDoubleClick={() => onAbrir(x.valor)}>
              {x.texto}
            </button>
          ))}
        </div>
        <span className="comp-rolo-marca" aria-hidden="true" />
      </div>
    </div>
  );
}

export function JanelaDaCompetencia({ competencias, competencia, onSeguir }: {
  competencias: { valor: string; rotulo: string }[];
  competencia: string;
  onSeguir: (c: string) => void;
}) {
  const pode = [...new Set(competencias.map(m => m.valor).filter(v => Number(v.slice(0, 4)) >= PRIMEIRO_ANO))].sort();
  const [c, setC] = useState(pode.includes(competencia) ? competencia : pode[pode.length - 1] || competencia);
  const ano = c.slice(0, 4);
  const anos = [...new Set(pode.map(v => v.slice(0, 4)))];
  const meses = pode.filter(v => v.startsWith(ano));
  /** outro ano: o mesmo mês, se já começou; senão, o último que dá */
  // a entrada: a janela cresce de leve com mola; as réguas e a dica chegam em cascata e as marcas sobem
  const caixa = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || menosMovimento()) return;
    animate(el, { opacity: [0, 1], scale: [0.92, 1], translateY: [16, 0], ease: spring({ bounce: 0.3, duration: 520 }) });
    animate(el.querySelectorAll('.comp-rolo-bloco, .comp-dica'), { opacity: [0, 1], translateY: [12, 0], duration: 420, delay: stagger(90, { start: 140 }), ease: 'outQuint' });
    animate(el.querySelectorAll('.comp-rolo-marca'), { scaleY: [0, 1], duration: 360, delay: stagger(90, { start: 320 }), ease: 'outBack' });
  }, []);
  const trocarAno = (a: string) => {
    const ms = pode.filter(v => v.startsWith(a));
    setC(ms.includes(a + c.slice(4)) ? a + c.slice(4) : ms[ms.length - 1] || c);
  };
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) onSeguir(competencia); }}>
      <div ref={caixa} className={classeDaJanela({}) + ' competencia-janela'} role="dialog" aria-modal="true" aria-label="Competência">
        <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={() => onSeguir(competencia)}><Icone nome="x" /></button>
        <div className="comp-rolos">
          <Rolo rotulo="Ano" itens={anos.map(a => ({ valor: a, texto: a }))} valor={ano} onEscolher={trocarAno} onAbrir={() => onSeguir(c)} />
          <Rolo rotulo="Mês" itens={meses.map(v => ({ valor: v, texto: NOMES[Number(v.slice(5, 7)) - 1] }))} valor={c} foco onEscolher={setC} onAbrir={onSeguir} />
        </div>
        <p className="hint comp-dica">Role até o mês e dê dois cliques para abrir</p>
      </div>
    </div>
  );
}
