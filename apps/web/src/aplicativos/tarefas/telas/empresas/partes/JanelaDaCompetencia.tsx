// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"). Volta do
// executor ou da página da empresa (a competência no endereço): não pergunta de novo.
// No formato de régua (Vitor, 05/10/2026: "só com ano e mês, o usuário usa o scroll para rolar o que ele quer"): duas
// faixas, Ano e Mês, que andam de lado de um em um (a rodinha do mouse também), deslizando; o do meio é o escolhido, em vermelho. Sem
// título e sem o Selecionar: dois cliques (ou Enter) abrem. Só de 2026 para frente e só os meses que já começaram.
import { classeDaJanela, Icone } from '@nads/ui';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  const [deslocamento, setDeslocamento] = useState(0);
  // a primeira posição vai direto (sem deslizar desde o começo da régua)
  const [desliza, setDesliza] = useState(false);
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
      // só depois de estar no lugar o trilho passa a deslizar (abrir a janela não anima)
      if (!centrou.current) { centrou.current = true; setTimeout(() => setDesliza(true), 60); }
    };
    centralizar();
    const ro = new ResizeObserver(centralizar);
    ro.observe(box);
    return () => ro.disconnect();
  }, [valor, itens.length]);
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
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { e.preventDefault(); passo(1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); passo(-1); }
          if (e.key === 'Enter') { e.preventDefault(); onAbrir(valor); }
        }}>
        <div ref={trilho} className={'comp-rolo-trilho' + (desliza ? ' desliza' : '')} style={{ transform: 'translateX(' + deslocamento + 'px)' }}>
          {itens.map(x => (
            <button key={x.valor} type="button" data-valor={x.valor} role="option" aria-selected={x.valor === valor} tabIndex={-1}
              className={'comp-rolo-item' + (x.valor === valor ? ' on' : '')} onClick={() => onEscolher(x.valor)} onDoubleClick={() => onAbrir(x.valor)}>
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
  const trocarAno = (a: string) => {
    const ms = pode.filter(v => v.startsWith(a));
    setC(ms.includes(a + c.slice(4)) ? a + c.slice(4) : ms[ms.length - 1] || c);
  };
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) onSeguir(competencia); }}>
      <div className={classeDaJanela({}) + ' competencia-janela'} role="dialog" aria-modal="true" aria-label="Competência">
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
