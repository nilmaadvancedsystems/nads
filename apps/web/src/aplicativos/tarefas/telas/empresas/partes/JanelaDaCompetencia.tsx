// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"). Volta do
// executor ou da página da empresa (a competência no endereço): não pergunta de novo.
// No formato de régua (Vitor, 05/10/2026: "só com ano e mês, o usuário usa o scroll para rolar o que ele quer"): duas
// faixas, Ano e Mês, que rolam de lado (a rodinha do mouse também); o que para no meio é o escolhido, em vermelho. Sem
// título e sem o Selecionar: dois cliques (ou Enter) abrem. Só de 2026 para frente e só os meses que já começaram.
import { classeDaJanela, Icone } from '@nads/ui';
import { useLayoutEffect, useRef, useState } from 'react';

const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
/** antes disso, nada (o sistema começou em 2026) */
const PRIMEIRO_ANO = 2026;

interface ItemDoRolo { valor: string; texto: string }

/** Uma régua que rola de lado: o item do meio é o escolhido; clicar leva ele para o meio; dois cliques abrem. */
function Rolo({ rotulo, itens, valor, foco, onEscolher, onAbrir }: {
  rotulo: string; itens: ItemDoRolo[]; valor: string; foco?: boolean; onEscolher: (v: string) => void; onAbrir: (v: string) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  // a escolha veio da rolagem da própria pessoa: não recentraliza (senão briga com a rodinha)
  const pelaRolagem = useRef(false);
  useLayoutEffect(() => {
    if (pelaRolagem.current) { pelaRolagem.current = false; return; }
    const box = caixa.current;
    const el = box?.querySelector<HTMLElement>('[data-valor="' + valor + '"]');
    if (box && el) box.scrollLeft = el.offsetLeft + el.offsetWidth / 2 - box.clientWidth / 2;
  }, [valor, itens.length]);
  const noMeio = () => {
    const box = caixa.current;
    if (!box) return null;
    const centro = box.scrollLeft + box.clientWidth / 2;
    let melhor: string | null = null;
    let dist = Infinity;
    box.querySelectorAll<HTMLElement>('[data-valor]').forEach(el => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centro);
      if (d < dist) { dist = d; melhor = el.dataset.valor || null; }
    });
    return melhor;
  };
  const i = itens.findIndex(x => x.valor === valor);
  return (
    <div className="comp-rolo-bloco">
      <span className="comp-rolo-rotulo">{rotulo}</span>
      <div className="comp-rolo-caixa">
        <div ref={caixa} className="comp-rolo" role="listbox" aria-label={rotulo} tabIndex={0} autoFocus={foco}
          onScroll={() => { const m = noMeio(); if (m && m !== valor) { pelaRolagem.current = true; onEscolher(m); } }}
          onWheel={e => { if (caixa.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) caixa.current.scrollLeft += e.deltaY; }}
          onKeyDown={e => {
            if (e.key === 'ArrowRight' && i < itens.length - 1) { e.preventDefault(); onEscolher(itens[i + 1].valor); }
            if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); onEscolher(itens[i - 1].valor); }
            if (e.key === 'Enter') { e.preventDefault(); onAbrir(valor); }
          }}>
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
