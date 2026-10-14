// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"). Volta do
// executor ou da página da empresa (a competência no endereço): não pergunta de novo.
// No jeito de um calendário (14/10/2026: "altere a seleção de competência para algo nesse estilo, só que com meses"): o ano
// no alto com ‹ ›, os 12 meses numa grade de 3 × 4 (o escolhido cheio na cor do app; o mês de hoje com um pontinho; os que
// ainda não começaram apagados) e o Abrir embaixo. Dois cliques (ou Enter) num mês também abrem; as setas andam pela grade.
// Só de 2026 para frente e só os meses que já começaram.
import { Icone, classeDaJanela } from '@nads/ui';
import { animate, spring, stagger } from 'animejs';
import { useLayoutEffect, useRef, useState } from 'react';

// As animações desta janela são pedido do Vitor (05/10/2026: "use o animejs para animar a entrada dessa seleção e a parte
// de selecionar também"): valem mesmo no nível Normal de animações; quem pediu menos movimento no computador não vê.
const menosMovimento = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
/** antes disso, nada (o sistema começou em 2026) */
const PRIMEIRO_ANO = 2026;

const mesDeHoje = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

export function JanelaDaCompetencia({ competencias, competencia, onSeguir }: {
  competencias: { valor: string; rotulo: string }[];
  competencia: string;
  onSeguir: (c: string) => void;
}) {
  const pode = [...new Set(competencias.map(m => m.valor).filter(v => Number(v.slice(0, 4)) >= PRIMEIRO_ANO))].sort();
  const [c, setC] = useState(pode.includes(competencia) ? competencia : pode[pode.length - 1] || competencia);
  const [ano, setAno] = useState(c.slice(0, 4));
  const anos = [...new Set(pode.map(v => v.slice(0, 4)))];
  const hoje = mesDeHoje();

  // a entrada: a janela cresce de leve com mola e os meses chegam em cascata
  const caixa = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || menosMovimento()) return;
    animate(el, { opacity: [0, 1], scale: [0.94, 1], translateY: [14, 0], ease: spring({ bounce: 0.28, duration: 500 }) });
    animate(el.querySelectorAll('.comp-mes'), { opacity: [0, 1], scale: [0.85, 1], duration: 380, delay: stagger(18, { start: 120 }), ease: 'outQuint' });
  }, []);
  // a parte de selecionar: o mês escolhido dá um pulinho
  const escolher = (v: string, botao?: HTMLElement | null) => {
    setC(v);
    if (botao && !menosMovimento()) animate(botao, { scale: [0.86, 1], ease: spring({ bounce: 0.45, duration: 360 }) });
  };
  // outro ano: os meses mudam no lugar (sem trocar o escolhido até clicar num mês)
  const iAno = anos.indexOf(ano);
  const irAoAno = (d: number) => {
    const a = anos[iAno + d];
    if (!a) return;
    setAno(a);
    const grade = caixa.current?.querySelector('.comp-meses');
    if (grade && !menosMovimento()) animate(grade.children, { opacity: [0, 1], translateX: [d * 10, 0], duration: 260, delay: stagger(10), ease: 'outQuint' });
  };
  // as setas andam pela grade (3 colunas), só pelos meses que dá
  const teclas = (e: React.KeyboardEvent) => {
    const passos: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 };
    if (e.key === 'Enter') { e.preventDefault(); onSeguir(c); return; }
    const p = passos[e.key];
    if (!p) return;
    e.preventDefault();
    const [a, m] = [Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1 + p];
    const alvo = new Date(a, m, 1);
    const v = alvo.getFullYear() + '-' + String(alvo.getMonth() + 1).padStart(2, '0');
    if (!pode.includes(v)) return;
    setAno(v.slice(0, 4));
    // o foco vai junto (o mês de outro ano só existe depois de desenhar)
    requestAnimationFrame(() => {
      const b = caixa.current?.querySelector<HTMLElement>('[data-mes="' + v + '"]');
      b?.focus();
      escolher(v, b);
    });
  };

  return (
    // sem fechar (Vitor, 05/10/2026: "não pode ter a opção de fechar caso não tenha selecionado a competência"): nem ×, nem
    // clicar fora; só sai escolhendo um mês
    <div className="modal-overlay">
      <div ref={caixa} className={classeDaJanela({}) + ' competencia-janela'} role="dialog" aria-modal="true" aria-label="Competência" onKeyDown={teclas}>
        <div className="comp-topo">
          <span className="comp-titulo">Competência</span>
          <div className="comp-ano">
            <button type="button" className="icon-btn icon-btn-sm" disabled={iAno <= 0} onClick={() => irAoAno(-1)} aria-label="Ano anterior" title="Ano anterior"><Icone nome="chevronLeft" /></button>
            <b className="num">{ano}</b>
            <button type="button" className="icon-btn icon-btn-sm" disabled={iAno >= anos.length - 1} onClick={() => irAoAno(1)} aria-label="Próximo ano" title="Próximo ano"><Icone nome="chevronRight" /></button>
          </div>
        </div>
        <div className="comp-meses" role="listbox" aria-label={'Meses de ' + ano}>
          {CURTOS.map((curto, k) => {
            const v = ano + '-' + String(k + 1).padStart(2, '0');
            const da = pode.includes(v);
            return (
              <button key={v} type="button" data-mes={v} role="option" aria-selected={v === c} disabled={!da}
                autoFocus={v === c} title={da ? NOMES[k] + ' de ' + ano : NOMES[k] + ' ainda não começou'}
                className={'comp-mes' + (v === c ? ' on' : '') + (v === hoje ? ' hoje' : '')}
                onClick={e => escolher(v, e.currentTarget)} onDoubleClick={() => onSeguir(v)}>
                {curto}
              </button>
            );
          })}
        </div>
        <div className="comp-pe">
          <span className="hint">{NOMES[Number(c.slice(5, 7)) - 1]} de {c.slice(0, 4)}</span>
          <button type="button" className="btn btn-primary" onClick={() => onSeguir(c)}>Abrir</button>
        </div>
      </div>
    </div>
  );
}
