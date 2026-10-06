// Os gráficos pequenos do painel das tarefas do Fiscal: as barras por dia do mês (o dia, as notas e o valor ao passar o
// mouse) e a tabelinha com barras (o rótulo, uma coluna opcional, a barra proporcional e o valor). Uma série só, na cor
// de destaque; o texto sempre nas cores de texto.
import { useState, type ReactNode } from 'react';

export interface BarraDoDia { dia: number; valor: number; qtd: number }

export function BarrasPorDia({ dias, formatar, rotulo }: { dias: readonly BarraDoDia[]; formatar: (v: number) => string; rotulo: string }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const max = Math.max(...dias.map(d => d.valor), 0);
  const d = sobre != null ? dias[sobre] : null;
  return (
    <figure className="pt-dias" aria-label={rotulo}>
      <figcaption className="pt-dias-topo">
        <span className="fraco">{rotulo}</span>
        <span className="pt-dias-dica">{d
          ? <><b>dia {d.dia}</b> · {d.qtd} {d.qtd === 1 ? 'nota' : 'notas'} · <b className="num">{formatar(d.valor)}</b></>
          : <span className="fraco">passe o mouse nos dias</span>}</span>
      </figcaption>
      <div className="pt-dias-barras" onMouseLeave={() => setSobre(null)}>
        {dias.map((x, i) => (
          <div key={x.dia} className={'pt-dia' + (sobre === i ? ' sobre' : '')} onMouseEnter={() => setSobre(i)}
            title={'Dia ' + x.dia + ': ' + x.qtd + (x.qtd === 1 ? ' nota, ' : ' notas, ') + formatar(x.valor)}>
            <span className="pt-dia-barra" style={{ height: max ? Math.max(x.valor > 0 ? 4 : 0, (x.valor / max) * 100) + '%' : 0 }} />
          </div>
        ))}
      </div>
      <div className="pt-dias-eixo fraco"><span>1</span><span>{Math.ceil(dias.length / 2)}</span><span>{dias.length}</span></div>
    </figure>
  );
}

export interface LinhaDeBarra { chave: string; rotulo: ReactNode; dica?: ReactNode; valor: number; texto: string; extra?: ReactNode; destaque?: boolean }

/** A tabelinha com barras: cada linha com o rótulo, uma coluna opcional (ex.: a quantidade), a barra e o valor. */
export function TabelaComBarras({ linhas, colunas }: { linhas: readonly LinhaDeBarra[]; colunas: { rotulo: string; extra?: string; valor?: string } }) {
  const topo = Math.max(...linhas.map(l => l.valor), 0);
  return (
    <div className="table-wrap pt-tabela">
      <table>
        <thead><tr><th>{colunas.rotulo}</th>{colunas.extra && <th className="num">{colunas.extra}</th>}<th className="pt-col-barra" aria-hidden="true" /><th className="num">{colunas.valor || 'Valor'}</th></tr></thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.chave} className={l.destaque ? 'pt-destaque' : undefined}>
              <td className="wrap"><span className="pt-rotulo">{l.rotulo}</span>{l.dica && <span className="fraco pt-dica">{l.dica}</span>}</td>
              {colunas.extra && <td className="num">{l.extra}</td>}
              <td className="pt-col-barra"><span className="pt-barra"><span style={{ width: topo ? Math.max(l.valor > 0 ? 2 : 0, (l.valor / topo) * 100) + '%' : 0 }} /></span></td>
              <td className="num">{l.texto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Os números grandes do topo do painel (ok: verde; atencao: amarelo). */
export function Numeros({ itens }: { itens: readonly { rotulo: string; valor: ReactNode; tom?: 'ok' | 'atencao' }[] }) {
  return (
    <div className="pt-numeros">
      {itens.map(i => (
        <div key={i.rotulo} className={'pt-numero' + (i.tom ? ' ' + i.tom : '')}><b className="num">{i.valor}</b><span>{i.rotulo}</span></div>
      ))}
    </div>
  );
}
