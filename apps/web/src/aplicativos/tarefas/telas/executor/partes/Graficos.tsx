// Os gráficos que o catálogo não tinha (Componentes › Gráficos: GR-03 Barras por dia, GR-04 Rosca, GR-05 Faixa 100%),
// feitos para o painel das tarefas do Fiscal (Vitor, 06/10/2026). O resto do painel usa as peças prontas do catálogo:
// Stat, rank, tabela padrão, Alerta, badge, gh-blank. Desenham o estado final; animarPainel.ts dá o movimento. As cores
// das categorias seguem a classe do CFOP (sempre a mesma cor para a mesma classe), com o nome e o valor ao lado.
import { formatos } from '@nads/core';
import { useState } from 'react';

const { reais } = formatos;
type Formato = 'reais' | 'int' | 'pct';
const formatar = (v: number, f: Formato) => (f === 'reais' ? reais(v) : f === 'pct' ? Math.round(v).toLocaleString('pt-BR') + '%' : Math.round(v).toLocaleString('pt-BR'));

/** Um número que conta do zero ao aparecer (vai como o valor do Stat). */
export function Conta({ valor, formato = 'int' }: { valor: number; formato?: Formato }) {
  return <span data-conta={valor} data-formato={formato}>{formatar(valor, formato)}</span>;
}

export interface BarraDoDia { dia: number; valor: number; qtd: number }

/** GR-03 · Barras por dia do mês: uma barra por dia; o dia, as notas e o valor ao passar o mouse. */
export function BarrasPorDia({ dias, rotulo }: { dias: readonly BarraDoDia[]; rotulo: string }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const max = Math.max(...dias.map(d => d.valor), 0);
  const d = sobre != null ? dias[sobre] : null;
  return (
    <figure className="graf-dias" aria-label={rotulo}>
      <figcaption className="graf-dias-topo">
        <span className="hint">{rotulo}</span>
        <span className="hint">{d ? <><b>dia {d.dia}</b> · {d.qtd} {d.qtd === 1 ? 'nota' : 'notas'} · <b className="num">{reais(d.valor)}</b></> : 'passe o mouse nos dias'}</span>
      </figcaption>
      <div className="graf-dias-barras" onMouseLeave={() => setSobre(null)}>
        {dias.map((x, i) => (
          <div key={x.dia} className={'graf-dia' + (sobre === i ? ' sobre' : '')} onMouseEnter={() => setSobre(i)}
            title={'Dia ' + x.dia + ': ' + x.qtd + (x.qtd === 1 ? ' nota, ' : ' notas, ') + reais(x.valor)}>
            <span style={{ height: max ? Math.max(x.valor > 0 ? 4 : 0, (x.valor / max) * 100) + '%' : 0 }} />
          </div>
        ))}
      </div>
      <div className="graf-dias-eixo hint"><span>1</span><span>{Math.ceil(dias.length / 2)}</span><span>{dias.length}</span></div>
    </figure>
  );
}

export interface Fatia { chave: string; rotulo: string; valor: number; pct: number; cor: number }

function Legenda({ fatias, valores }: { fatias: readonly Fatia[]; valores?: boolean }) {
  return (
    <ul className={'graf-legenda' + (valores ? '' : ' em-linha')}>
      {fatias.map(f => (
        <li key={f.chave}><i style={{ background: 'var(--cat-' + f.cor + ')' }} /><span>{f.rotulo}</span><b className="num">{f.pct.toLocaleString('pt-BR')}%</b>{valores && <span className="hint num">{reais(f.valor)}</span>}</li>
      ))}
    </ul>
  );
}

/** GR-04 · Rosca: a composição (ex.: a receita por natureza), com o total no meio e a legenda ao lado. */
export function Rosca({ fatias, centro, rotuloCentro }: { fatias: readonly Fatia[]; centro: number; rotuloCentro: string }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const VAO = fatias.length > 1 ? 2 : 0;
  let andou = 0;
  return (
    <div className="graf-rosca">
      <div className="graf-rosca-grafico">
        <svg viewBox="0 0 120 120" width="148" height="148" role="img" aria-label={fatias.map(f => f.rotulo + ' ' + f.pct + '%').join(', ')}>
          <circle cx="60" cy="60" r={R} className="graf-rosca-fundo" />
          {fatias.map(f => {
            const comp = Math.max(0, (f.pct / 100) * C - VAO);
            const el = (
              <circle key={f.chave} cx="60" cy="60" r={R} className="graf-rosca-fatia" style={{ stroke: 'var(--cat-' + f.cor + ')' }}
                strokeDasharray={comp + ' ' + (C - comp)} strokeDashoffset={-andou} transform="rotate(-90 60 60)">
                <title>{f.rotulo}: {f.pct.toLocaleString('pt-BR')}% · {reais(f.valor)}</title>
              </circle>
            );
            andou += (f.pct / 100) * C;
            return el;
          })}
        </svg>
        <div className="graf-rosca-meio"><b className="num"><Conta valor={centro} formato="reais" /></b><span className="hint">{rotuloCentro}</span></div>
      </div>
      <Legenda fatias={fatias} valores />
    </div>
  );
}

/** GR-05 · Faixa 100%: a composição numa barra só, cada pedaço com a sua cor, e a legenda embaixo. */
export function Faixa({ fatias }: { fatias: readonly Fatia[] }) {
  return (
    <div className="graf-faixa-bloco">
      <div className="graf-faixa" role="img" aria-label={fatias.map(f => f.rotulo + ' ' + f.pct + '%').join(', ')}>
        {fatias.map(f => <span key={f.chave} style={{ width: f.pct + '%', background: 'var(--cat-' + f.cor + ')' }} title={f.rotulo + ': ' + f.pct.toLocaleString('pt-BR') + '% · ' + reais(f.valor)} />)}
      </div>
      <Legenda fatias={fatias} />
    </div>
  );
}
