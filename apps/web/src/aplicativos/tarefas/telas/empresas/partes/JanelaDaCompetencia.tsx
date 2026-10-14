// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"). Volta do
// executor ou da página da empresa (a competência no endereço): não pergunta de novo.
// No jeito de um calendário (14/10/2026: "altere a seleção de competência para algo nesse estilo, só que com meses"): o ano
// no alto com ‹ ›, os 12 meses numa grade de 3 × 4 (o escolhido cheio na cor do app; o mês de hoje com um pontinho; os que
// ainda não começaram apagados) e o Abrir embaixo. Dois cliques (ou Enter) num mês também abrem; as setas andam pela grade.
// Só de 2026 para frente e só os meses que já começaram.
import { Icone, classeDaJanela } from '@nads/ui';
import type { JSAnimation } from 'animejs';
import { animate, cleanInlineStyles, utils } from 'animejs';
import { useLayoutEffect, useRef, useState } from 'react';

// As animações desta janela são pedido do Vitor (05/10/2026: "use o animejs para animar a entrada dessa seleção e a parte
// de selecionar também"; 14/10/2026: "use o animejs para animar a entrada e seleção desse calendario"): valem mesmo no
// nível Normal de animações; quem pediu menos movimento no computador não vê nada, só o estado final. Todas partem do
// estado visível (o CSS já deixa tudo no lugar) e nenhuma segura o clique.
const menosMovimento = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** a opacidade de repouso de um mês (o que ainda não começou fica apagado, como no CSS) */
const repouso = (b: HTMLButtonElement) => (b.disabled ? 0.45 : 1);

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

  const caixa = useRef<HTMLDivElement>(null);
  const grade = useRef<HTMLDivElement>(null);
  const pilula = useRef<HTMLSpanElement>(null);
  const rodape = useRef<HTMLSpanElement>(null);
  // onde a pílula está (para deslizar só dentro do mesmo ano), a animação dela e para que lado o ano andou
  const ondePilula = useRef<string | null>(null);
  const andando = useRef<JSAnimation | null>(null);
  const sentido = useRef(0);
  const primeiraVez = useRef(true);

  // a entrada (200 ms): a janela sobe de leve e acende; os meses chegam em cascata curta (14 ms entre um e outro)
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el || menosMovimento()) return;
    animate(el, { opacity: [0, 1], scale: [0.96, 1], translateY: [8, 0], duration: 200, ease: 'outQuint', onComplete: a => { cleanInlineStyles(a); } });
    grade.current?.querySelectorAll<HTMLButtonElement>('.comp-mes').forEach((b, k) => {
      animate(b, { opacity: [0, repouso(b)], translateY: [6, 0], duration: 150, delay: 30 + k * 14, ease: 'outQuint', onComplete: a => { cleanInlineStyles(a); } });
    });
  }, []);

  // a pílula azul: vai do mês de antes ao de agora (200 ms). Mudou de ano ou acabou de abrir: aparece no lugar, acendendo.
  // Até a pílula ser posta, o próprio mês escolhido já está cheio (o CSS); depois ela assume (.com-pilula na grade).
  useLayoutEffect(() => {
    const g = grade.current;
    const p = pilula.current;
    if (!g || !p) return;
    const b = g.querySelector<HTMLElement>('[data-mes="' + c + '"]');
    const antes = ondePilula.current;
    andando.current?.pause();
    if (!b) { p.style.display = 'none'; g.classList.remove('com-pilula'); ondePilula.current = null; return; }
    const x = b.offsetLeft;
    const y = b.offsetTop;
    p.style.display = 'block';
    p.style.width = b.offsetWidth + 'px';
    p.style.height = b.offsetHeight + 'px';
    g.classList.add('com-pilula');
    ondePilula.current = ano;
    if (menosMovimento()) { utils.set(p, { translateX: x, translateY: y, opacity: 1 }); return; }
    if (antes === ano) {
      // de onde ela está agora (pode ter sido apertado de novo no meio do caminho)
      const m = new DOMMatrixReadOnly(getComputedStyle(p).transform);
      andando.current = animate(p, { translateX: [m.m41, x], translateY: [m.m42, y], duration: 200, ease: 'outQuint' });
    } else {
      utils.set(p, { translateX: x, translateY: y });
      andando.current = animate(p, { opacity: [0, 1], duration: 200, delay: antes === null && primeiraVez.current ? 120 : 60, ease: 'outQuint' });
    }
  }, [c, ano]);

  // outro ano: a grade desliza para o lado da seta (os meses novos chegam com 12 px de deslocamento, 200 ms)
  useLayoutEffect(() => {
    const d = sentido.current;
    sentido.current = 0;
    if (!d || menosMovimento()) return;
    grade.current?.querySelectorAll<HTMLButtonElement>('.comp-mes').forEach((b, k) => {
      animate(b, { opacity: [0, repouso(b)], translateX: [d * 12, 0], duration: 200, delay: k * 8, ease: 'outQuint', onComplete: a => { cleanInlineStyles(a); } });
    });
  }, [ano]);

  // o texto do rodapé troca sem pulo: o novo chega de 3 px abaixo, acendendo (o Abrir fica parado à direita)
  useLayoutEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return; }
    const el = rodape.current;
    if (!el || menosMovimento()) return;
    animate(el, { opacity: [0, 1], translateY: [3, 0], duration: 160, ease: 'outQuint', onComplete: a => { cleanInlineStyles(a); } });
  }, [c]);

  const escolher = (v: string) => { setC(v); };
  // outro ano: os meses mudam no lugar (sem trocar o escolhido até clicar num mês)
  const iAno = anos.indexOf(ano);
  const irAoAno = (d: number) => {
    const a = anos[iAno + d];
    if (!a) return;
    sentido.current = d;
    setAno(a);
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
    sentido.current = Math.sign(Number(v.slice(0, 4)) - Number(ano));
    setAno(v.slice(0, 4));
    // o foco vai junto (o mês de outro ano só existe depois de desenhar)
    requestAnimationFrame(() => {
      caixa.current?.querySelector<HTMLElement>('[data-mes="' + v + '"]')?.focus();
      escolher(v);
    });
  };

  return (
    // sem fechar (Vitor, 05/10/2026: "não pode ter a opção de fechar caso não tenha selecionado a competência"): nem ×, nem
    // clicar fora; só sai escolhendo um mês. data-entrada-propria: a janela se anima aqui (o animador só acende o fundo)
    <div className="modal-overlay" data-entrada-propria="">
      <div ref={caixa} className={classeDaJanela({}) + ' competencia-janela'} role="dialog" aria-modal="true" aria-label="Competência" onKeyDown={teclas}>
        <div className="comp-topo">
          <span className="comp-titulo">Competência</span>
          <div className="comp-ano">
            <button type="button" className="icon-btn icon-btn-sm" disabled={iAno <= 0} onClick={() => irAoAno(-1)} aria-label="Ano anterior" title="Ano anterior"><Icone nome="chevronLeft" /></button>
            <b className="num">{ano}</b>
            <button type="button" className="icon-btn icon-btn-sm" disabled={iAno >= anos.length - 1} onClick={() => irAoAno(1)} aria-label="Próximo ano" title="Próximo ano"><Icone nome="chevronRight" /></button>
          </div>
        </div>
        <div ref={grade} className="comp-meses" role="listbox" aria-label={'Meses de ' + ano}>
          <span ref={pilula} className="comp-pilula" aria-hidden="true" />
          {CURTOS.map((curto, k) => {
            const v = ano + '-' + String(k + 1).padStart(2, '0');
            const da = pode.includes(v);
            return (
              <button key={v} type="button" data-mes={v} role="option" aria-selected={v === c} disabled={!da}
                autoFocus={v === c} title={da ? NOMES[k] + ' de ' + ano : NOMES[k] + ' ainda não começou'}
                className={'comp-mes' + (v === c ? ' on' : '') + (v === hoje ? ' hoje' : '')}
                onClick={() => escolher(v)} onDoubleClick={() => onSeguir(v)}>
                {curto}
              </button>
            );
          })}
        </div>
        <div className="comp-pe">
          <span ref={rodape} className="hint">{NOMES[Number(c.slice(5, 7)) - 1]} de {c.slice(0, 4)}</span>
          <button type="button" className="btn btn-primary" onClick={() => onSeguir(c)}>Abrir</button>
        </div>
      </div>
    </div>
  );
}
