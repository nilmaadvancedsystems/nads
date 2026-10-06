// Os gráficos do painel das tarefas do Fiscal, cada tarefa com o seu jeito (Vitor, 06/10/2026: "achei repetitivo"): o
// número que conta, o destaque com chips, as barras por dia, a tabelinha com barras, o anel (SIEG × Alterdata), o
// medidor (duas barras), a rosca e a faixa 100% (a composição), o ranking (as retenções) e a balança (débitos ×
// créditos). Desenham o estado final; animarPainel.ts dá o movimento. As cores das categorias seguem a classe do CFOP
// (sempre a mesma cor para a mesma classe), com o nome e o valor ao lado (nunca só a cor).
import { formatos } from '@nads/core';
import { Icone, type NomeIcone } from '@nads/ui';
import { useState, type ReactNode } from 'react';

const { reais } = formatos;
type Formato = 'reais' | 'int' | 'pct';
const formatar = (v: number, f: Formato) => (f === 'reais' ? reais(v) : f === 'pct' ? Math.round(v).toLocaleString('pt-BR') + '%' : Math.round(v).toLocaleString('pt-BR'));

/** Um número que conta do zero ao aparecer. */
export function Conta({ valor, formato = 'int' }: { valor: number; formato?: Formato }) {
  return <span className="num" data-conta={valor} data-formato={formato}>{formatar(valor, formato)}</span>;
}

/** O número grande do painel, com chips embaixo. */
export function Destaque({ rotulo, valor, formato = 'reais', chips }: { rotulo: string; valor: number; formato?: Formato; chips?: readonly { icone: NomeIcone; texto: ReactNode; tom?: 'atencao' }[] }) {
  return (
    <div className="pt-destaque-num pt-entra">
      <span className="fraco">{rotulo}</span>
      <b><Conta valor={valor} formato={formato} /></b>
      {chips && chips.length > 0 && (
        <div className="pt-chips">{chips.map((c, i) => <span key={i} className={'pt-chip' + (c.tom ? ' ' + c.tom : '')}><Icone nome={c.icone} />{c.texto}</span>)}</div>
      )}
    </div>
  );
}

export interface BarraDoDia { dia: number; valor: number; qtd: number }

export function BarrasPorDia({ dias, rotulo }: { dias: readonly BarraDoDia[]; rotulo: string }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const max = Math.max(...dias.map(d => d.valor), 0);
  const d = sobre != null ? dias[sobre] : null;
  return (
    <figure className="pt-dias pt-entra" aria-label={rotulo}>
      <figcaption className="pt-dias-topo">
        <span className="fraco">{rotulo}</span>
        <span className="pt-dias-dica">{d
          ? <><b>dia {d.dia}</b> · {d.qtd} {d.qtd === 1 ? 'nota' : 'notas'} · <b className="num">{reais(d.valor)}</b></>
          : <span className="fraco">passe o mouse nos dias</span>}</span>
      </figcaption>
      <div className="pt-dias-barras" onMouseLeave={() => setSobre(null)}>
        {dias.map((x, i) => (
          <div key={x.dia} className={'pt-dia' + (sobre === i ? ' sobre' : '')} onMouseEnter={() => setSobre(i)}
            title={'Dia ' + x.dia + ': ' + x.qtd + (x.qtd === 1 ? ' nota, ' : ' notas, ') + reais(x.valor)}>
            <span className="pt-dia-barra" style={{ height: max ? Math.max(x.valor > 0 ? 4 : 0, (x.valor / max) * 100) + '%' : 0 }} />
          </div>
        ))}
      </div>
      <div className="pt-dias-eixo fraco"><span>1</span><span>{Math.ceil(dias.length / 2)}</span><span>{dias.length}</span></div>
    </figure>
  );
}

export interface LinhaDeBarra { chave: string; rotulo: ReactNode; dica?: ReactNode; valor: number; texto: string; extra?: ReactNode; destaque?: boolean }

/** A tabelinha com barras: o rótulo, uma coluna opcional (ex.: a quantidade), a barra e o valor. */
export function TabelaComBarras({ linhas, colunas }: { linhas: readonly LinhaDeBarra[]; colunas: { rotulo: string; extra?: string; valor?: string } }) {
  const topo = Math.max(...linhas.map(l => l.valor), 0);
  return (
    <div className="table-wrap pt-tabela pt-entra">
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

/**
 * O anel: quanto do SIEG já entrou no Alterdata (o número no meio). Verde quando bate; amarelo quando falta ou sobra.
 * Ao lado, o que cada lado tem e o que dizer.
 */
export function Anel({ sieg, importadas, rotuloSieg, rotuloImportadas }: { sieg: number | null; importadas: number; rotuloSieg: string; rotuloImportadas: string }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const pct = sieg ? Math.min(1, importadas / sieg) : importadas ? 1 : 0;
  const bate = sieg != null && sieg === importadas;
  const tom = sieg == null ? '' : bate ? ' ok' : ' atencao';
  return (
    <div className={'pt-anel pt-entra' + tom}>
      <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
        <circle cx="60" cy="60" r={R} className="pt-anel-fundo" />
        <circle cx="60" cy="60" r={R} className="pt-anel-arco" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} data-arco={C} data-fim={C * (1 - pct)} transform="rotate(-90 60 60)" />
      </svg>
      <div className="pt-anel-meio"><b>{sieg ? <Conta valor={pct * 100} formato="pct" /> : '—'}</b><span className="fraco">do SIEG</span></div>
      <div className="pt-anel-lado">
        <p><span className="fraco">{rotuloSieg}</span><b>{sieg == null ? '—' : <Conta valor={sieg} />}</b></p>
        <p><span className="fraco">{rotuloImportadas}</span><b><Conta valor={importadas} /></b></p>
        <p className="pt-anel-veredito">
          {sieg == null ? <><Icone nome="clock" />O SIEG ainda não contou este mês</>
            : bate ? <><Icone nome="checkCircle" />Bate com o SIEG</>
              : importadas < sieg ? <><Icone nome="alert" />Faltam {sieg - importadas} no Alterdata</>
                : <><Icone nome="alert" />{importadas - sieg} a mais que o SIEG</>}
        </p>
      </div>
    </div>
  );
}

/** O medidor: duas barras deitadas, uma sobre a outra, para comparar dois números (ex.: SIEG × Alterdata). */
export function Medidor({ itens }: { itens: readonly { rotulo: string; valor: number; formato?: Formato; tom?: 'fraco' }[] }) {
  const max = Math.max(...itens.map(i => i.valor), 0);
  return (
    <div className="pt-medidor pt-entra">
      {itens.map(i => (
        <div key={i.rotulo} className={'pt-medidor-linha' + (i.tom ? ' ' + i.tom : '')}>
          <span className="pt-medidor-rotulo">{i.rotulo}</span>
          <span className="pt-medidor-barra"><span style={{ width: max ? Math.max(i.valor > 0 ? 2 : 0, (i.valor / max) * 100) + '%' : 0 }} /></span>
          <b><Conta valor={i.valor} formato={i.formato} /></b>
        </div>
      ))}
    </div>
  );
}

export interface Fatia { chave: string; rotulo: string; valor: number; pct: number; cor: number }

/** A rosca da composição, com a legenda (a cor, o nome, a fatia e o valor) ao lado. */
export function Rosca({ fatias, centro, rotuloCentro }: { fatias: readonly Fatia[]; centro: number; rotuloCentro: string }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const VAO = fatias.length > 1 ? 2 : 0;
  let andou = 0;
  return (
    <div className="pt-rosca pt-entra">
      <div className="pt-rosca-grafico">
        <svg viewBox="0 0 120 120" width="148" height="148" role="img" aria-label={fatias.map(f => f.rotulo + ' ' + f.pct + '%').join(', ')}>
          <circle cx="60" cy="60" r={R} className="pt-anel-fundo" />
          {fatias.map(f => {
            const comp = Math.max(0, (f.pct / 100) * C - VAO);
            const el = (
              <circle key={f.chave} cx="60" cy="60" r={R} className="pt-rosca-fatia" style={{ stroke: 'var(--cat-' + f.cor + ')' }}
                strokeDasharray={comp + ' ' + (C - comp)} strokeDashoffset={-andou}
                transform="rotate(-90 60 60)"><title>{f.rotulo}: {f.pct.toLocaleString('pt-BR')}% · {reais(f.valor)}</title></circle>
            );
            andou += (f.pct / 100) * C;
            return el;
          })}
        </svg>
        <div className="pt-rosca-meio"><b><Conta valor={centro} formato="reais" /></b><span className="fraco">{rotuloCentro}</span></div>
      </div>
      <ul className="pt-legenda">
        {fatias.map(f => (
          <li key={f.chave}><i style={{ background: 'var(--cat-' + f.cor + ')' }} /><span>{f.rotulo}</span><b className="num">{f.pct.toLocaleString('pt-BR')}%</b><span className="fraco num">{reais(f.valor)}</span></li>
        ))}
      </ul>
    </div>
  );
}

/** A faixa 100%: a composição numa barra só, cada pedaço com a sua cor, e a legenda embaixo. */
export function Faixa({ fatias }: { fatias: readonly Fatia[] }) {
  return (
    <div className="pt-faixa-bloco pt-entra">
      <div className="pt-faixa" role="img" aria-label={fatias.map(f => f.rotulo + ' ' + f.pct + '%').join(', ')}>
        {fatias.map(f => <span key={f.chave} style={{ width: f.pct + '%', background: 'var(--cat-' + f.cor + ')' }} title={f.rotulo + ': ' + f.pct.toLocaleString('pt-BR') + '% · ' + reais(f.valor)} />)}
      </div>
      <ul className="pt-legenda pt-legenda-linha">
        {fatias.map(f => (
          <li key={f.chave}><i style={{ background: 'var(--cat-' + f.cor + ')' }} /><span>{f.rotulo}</span><b className="num">{f.pct.toLocaleString('pt-BR')}%</b></li>
        ))}
      </ul>
    </div>
  );
}

/** O ranking: quem mais pesou (a inicial, o nome, de onde veio, a barra e o valor). */
export function Ranking({ linhas }: { linhas: readonly { chave: string; nome: string; dica: string; valor: number }[] }) {
  const max = Math.max(...linhas.map(l => l.valor), 0);
  return (
    <ol className="pt-ranking pt-entra">
      {linhas.map((l, i) => (
        <li key={l.chave}>
          <span className="pt-ranking-pos">{i + 1}</span>
          <span className="pt-ranking-nome"><b>{l.nome}</b><span className="fraco">{l.dica}</span></span>
          <span className="pt-barra"><span style={{ width: max ? (l.valor / max) * 100 + '%' : 0 }} /></span>
          <b className="num">{reais(l.valor)}</b>
        </li>
      ))}
    </ol>
  );
}

/** A balança: dois pratos (ex.: débitos das saídas × créditos das entradas) e o saldo. */
export function Balanca({ esquerda, direita, saldo }: { esquerda: { rotulo: string; valor: number }; direita: { rotulo: string; valor: number }; saldo: string }) {
  const max = Math.max(esquerda.valor, direita.valor, 0);
  const lado = (x: { rotulo: string; valor: number }, cls: string) => (
    <div className={'pt-balanca-prato ' + cls}>
      <span className="fraco">{x.rotulo}</span>
      <b><Conta valor={x.valor} formato="reais" /></b>
      <span className="pt-balanca-barra"><span style={{ width: max ? (x.valor / max) * 100 + '%' : 0 }} /></span>
    </div>
  );
  return (
    <div className="pt-balanca pt-entra">
      {lado(esquerda, 'esq')}
      <div className="pt-balanca-meio"><Icone nome="scale" /><span className="fraco">{saldo}</span></div>
      {lado(direita, 'dir')}
    </div>
  );
}
