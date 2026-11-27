// Fiscal › Projeção do Fator R (26/11/2026: a planilha "PROJEÇÃO FATOR R 6.0" do Fiscal). De cima para baixo: na barra, a
// empresa, o ano da projeção, Subir PDF do PGDAS-D, Exportar Excel e Imprimir; o Fator R de hoje em números (o "banco de
// dados" da planilha); o aviso do primeiro mês da projeção que cai no Anexo V; e a tabela, um mês por linha (o ano anterior e
// o da projeção), com a receita e a folha (digitadas na célula quando não vêm do PGDAS-D), o fator do mês, a RBT12, a FS12, o
// Fator R do PA em destaque, o Anexo e a folha que falta para 28%. Só as peças do catálogo (EmpresaDaBarra, Cartão, Tabela
// padrão, Alerta, Dica, Vazio, Esqueleto).
import { Alerta, Dica, Esqueleto, Icone, useCarregando, Vazio } from '@nads/ui';
import type { tarefas } from '@nads/core';
import { Fragment, useState } from 'react';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { useProjecaoDoFatorR, type CampoDoMes, type VmProjecaoDoFatorR } from './useProjecaoDoFatorR';
import './projecaoDoFatorR.css';

const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number | null) => (n == null ? '—' : num(n) + '%');

export function ProjecaoDoFatorR() {
  const vm = useProjecaoDoFatorR();
  useCarregando(vm.carregando || vm.lendoPdf);
  if (!vm.pode) {
    return <section className="fc"><div className="card fc-cartao"><Vazio icone="lock" titulo="Só o Fiscal e o admin usam a Projeção do Fator R" texto="Peça a quem é do Fiscal." /></div></section>;
  }
  return (
    <section className="fc">
      <div className="tarefas-barra-topo fc-topo">
        <EmpresaDaBarra vm={vm} id="fator-r-empresas" />
        <span className="frp-ano" role="group" aria-label="Ano da projeção">
          <button type="button" className="icon-btn" onClick={vm.anoAnterior} aria-label="Ano anterior"><Icone nome="chevronLeft" width={16} height={16} /></button>
          <b>{vm.ano}</b>
          <button type="button" className="icon-btn" onClick={vm.anoSeguinte} aria-label="Ano seguinte"><Icone nome="chevronRight" width={16} height={16} /></button>
        </span>
        <span className="tarefas-barra-espaco" />
        <label className={'btn btn-outline frp-subir' + (vm.temRelatorio && !vm.lendoPdf ? '' : ' frp-subir-apagado')} aria-disabled={!vm.temRelatorio || vm.lendoPdf}>
          <Icone nome="upload" width={16} height={16} />{vm.lendoPdf ? 'Lendo o PDF…' : 'Subir PDF do PGDAS-D'}
          <input type="file" accept="application/pdf,.pdf" className="frp-arquivo" disabled={!vm.temRelatorio || vm.lendoPdf}
            onChange={e => { const a = e.target.files?.[0]; e.target.value = ''; void vm.subirPdf(a); }} />
        </label>
        <button type="button" className="btn btn-outline" disabled={!vm.temRelatorio} onClick={vm.exportar}><Icone nome="download" width={16} height={16} />Exportar Excel</button>
        <button type="button" className="btn btn-outline" disabled={!vm.temRelatorio} onClick={vm.imprimir}><Icone nome="printer" width={16} height={16} />Imprimir</button>
      </div>
      {vm.exemplos && <p className="hint fc-exemplo">Dados de exemplo: números inventados; o ano corrente como se o robô do e-CAC já tivesse baixado o PGDAS-D.</p>}
      {vm.erro && <Alerta naLinha titulo={vm.erro} onFechar={vm.fecharErro} />}

      {!vm.empresa ? <div className="card fc-cartao"><Vazio icone="recibo" titulo="Escolha a empresa" texto="A receita vem do PGDAS-D que o robô do e-CAC baixa; o que faltar se digita aqui ou sai do PDF do extrato." /></div>
        : vm.carregando ? <Esqueleto linhas={8} />
        : vm.falhou ? <div className="card fc-cartao"><Vazio icone="alert" titulo="Não deu para ler a projeção" texto="Sem permissão ou sem internet. Recarregue a página." /></div>
        : <Projecao vm={vm} />}
    </section>
  );
}

/** o Anexo com cor, ícone e texto (a cor nunca sozinha) */
function Selo({ anexo, curto }: { anexo: 'III' | 'V'; curto?: boolean }) {
  return <span className={'frp-selo frp-selo-' + anexo}><Icone nome={anexo === 'III' ? 'check' : 'alert'} width={12} height={12} />{curto ? anexo : 'Anexo ' + anexo}</span>;
}

/** o Fator R de cada PA em barras (verde no III, vermelho no V), a linha tracejada dos 28% e a dica ao passar o mouse */
function Grafico({ vm }: { vm: VmProjecaoDoFatorR }) {
  const [foco, setFoco] = useState<number | null>(null);
  const { barras, escala } = vm.grafico;
  const L = 40, R = 12, T = 16, B = 40, W = 960, H = 240;
  const passo = (W - L - R) / barras.length;
  const larg = Math.max(6, passo - 8);
  const y = (p: number) => T + (H - T - B) * (1 - Math.min(p, escala) / escala);
  const x = (i: number) => L + passo * i + (passo - larg) / 2;
  const iProjecao = barras.findIndex(b => b.projecao);
  const minimo = vm.minimo;
  const b = foco != null ? barras[foco] : null;
  const marcas = Array.from({ length: escala / 10 + 1 }, (_, i) => i * 10);
  // a barra com a ponta de cima arredondada (4px) e presa na base
  const barra = (x0: number, y0: number) => {
    const r = Math.min(4, larg / 2, y(0) - y0);
    return `M${x0},${y(0)} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + larg - r} Q${x0 + larg},${y0} ${x0 + larg},${y0 + r} V${y(0)} Z`;
  };
  return (
    <section className="card fc-cartao">
      <header className="fc-cartao-topo">
        <h3 className="fc-cartao-titulo">Fator R de cada PA<Dica texto="A barra é o Fator R dos 12 meses antes do PA. Apagada: a janela ainda não tem os 12 meses com receita e folha." /></h3>
        <span className="fc-acoes frp-legenda">
          <span><i className="frp-leg frp-leg-III" />Anexo III</span>
          <span><i className="frp-leg frp-leg-V" />Anexo V</span>
          <span><i className="frp-leg frp-leg-linha" />{num(minimo).replace(',00', '')}%</span>
          <span><i className="frp-leg frp-leg-incompleto" />janela incompleta</span>
        </span>
      </header>
      <div className="frp-grafico" onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fator R de cada PA, em barras; a tabela embaixo tem os números">
          {iProjecao > 0 && <rect className="frp-g-projecao" x={L + passo * iProjecao} y={T - 10} width={W - R - L - passo * iProjecao} height={H - T - B + 10} rx={6} />}
          {iProjecao > 0 && <text className="frp-g-rotulo-projecao" x={L + passo * iProjecao + 8} y={T + 2}>projeção</text>}
          {marcas.map(m => (
            <g key={m}>
              <line className="frp-g-grade" x1={L} x2={W - R} y1={y(m)} y2={y(m)} />
              <text className="frp-g-eixo" x={L - 6} y={y(m) + 4} textAnchor="end">{m}%</text>
            </g>
          ))}
          {barras.map((d, i) => (
            <g key={d.competencia}>
              {d.fator != null && d.fator > 0 && (
                <path d={barra(x(i), y(d.fator))} className={'frp-g-barra frp-g-' + d.anexo + (d.incompleto ? ' frp-g-incompleto' : '') + (foco === i ? ' frp-g-foco' : '')} />
              )}
              <text className={'frp-g-mes' + (d.atual ? ' frp-g-atual' : '')} x={x(i) + larg / 2} y={H - B + 16} textAnchor="middle">{d.mes}</text>
              {(i === 0 || d.mes === 'jan') && <text className="frp-g-ano" x={x(i) + larg / 2} y={H - B + 32} textAnchor="middle">{d.ano}</text>}
              {d.atual && <circle className="frp-g-hoje" cx={x(i) + larg / 2} cy={H - B + 28} r={3} />}
              <rect className="frp-g-alvo" x={L + passo * i} y={T} width={passo} height={H - T - B + 20} onMouseEnter={() => setFoco(i)} />
            </g>
          ))}
          <line className="frp-g-minimo" x1={L} x2={W - R} y1={y(minimo)} y2={y(minimo)} />
          <text className="frp-g-minimo-rotulo" x={W - R - 4} y={y(minimo) - 5} textAnchor="end">{num(minimo).replace(',00', '')}%</text>
        </svg>
        {b && foco != null && (
          <div className={'frp-dica' + (foco > barras.length / 2 ? ' frp-dica-esq' : '')} style={{ left: ((x(foco) + larg / 2) / W) * 100 + '%' }}>
            <b>PA {vm.mesAno(b.competencia)}</b>
            <span className="frp-dica-fator">{pct(b.fator)}{b.anexo && <Selo anexo={b.anexo} curto />}</span>
            <span>RBT12 <b className="num">{num(b.rbt12)}</b></span>
            <small>receita de {vm.mesAno(b.de)} a {vm.mesAno(b.ate)}</small>
            <span>FS12 <b className="num">{num(b.fs12)}</b></span>
            <small>folha de {vm.mesAno(b.folhaDe)} a {vm.mesAno(b.folhaAte)} ({b.defasagem} {b.defasagem === 1 ? 'mês' : 'meses'} depois)</small>
            {!!b.folhaQueFalta && <span>Falta de folha <b className="num">{num(b.folhaQueFalta)}</b></span>}
            {b.incompleto && <small>janela sem os 12 meses</small>}
          </div>
        )}
      </div>
    </section>
  );
}

function Projecao({ vm }: { vm: VmProjecaoDoFatorR }) {
  const h = vm.hoje;
  const v = vm.primeiroNoV;
  const minimo = num(vm.minimo).replace(',00', '') + '%';
  return (
    <>
      {vm.foraDoSimples && <Alerta naLinha titulo={'Esta empresa é do ' + vm.regime} texto="O Fator R só vale no Simples Nacional. A conta sai do mesmo jeito." />}
      <section className="card fc-cartao">
        <header className="fc-cartao-topo">
          <h3 className="fc-cartao-titulo">Fator R hoje{h && <span className="fraco">· PA {vm.mesAno(h.pa)}</span>}
            <Dica texto="A folha dos 12 meses antes do PA (FS12) ÷ a receita bruta dos mesmos 12 meses (RBT12). De 28% para cima, Anexo III; abaixo, Anexo V." /></h3>
          <span className="fc-acoes fc-sub">{vm.comPgdas ? 'PGDAS-D do e-CAC, ' + vm.pgdasConsultadoEm : 'Sem o PGDAS-D do robô: receita e folha digitadas ou do PDF'}</span>
        </header>
        {h ? (
          <div className="frp-hoje">
            <div className="frp-hoje-principal">
              <span className="fc-rotulo">Fator R do PA {vm.mesAno(h.pa)}</span>
              <div className="frp-hoje-numero"><b className="num">{pct(h.fator)}</b>{h.anexo && <Selo anexo={h.anexo} />}</div>
              {vm.regua && (
                <div className="frp-regua" role="img" aria-label={'Fator R ' + pct(h.fator) + ', a marca dos ' + minimo + ' em ' + minimo}>
                  <i className={'frp-regua-barra frp-regua-' + h.anexo} style={{ width: vm.regua.preenchido + '%' }} />
                  <span className="frp-regua-marca" style={{ left: vm.regua.marca + '%' }}><small>{minimo}</small></span>
                </div>
              )}
              <p className="frp-hoje-frase">
                {h.folhaQueFalta ? <>Faltam <b>{vm.brl(h.folhaQueFalta)}</b> de folha nos 12 meses para chegar a {minimo}.</>
                  : h.fator != null ? <>Acima dos {minimo}: a folha dos 12 meses já basta para o Anexo III.</> : 'Sem receita nos 12 meses antes do PA.'}
              </p>
            </div>
            <dl className="frp-hoje-numeros">
              <div><dt>RBT12</dt><dd className="num">{num(h.rbt12)}</dd><small>receita de {vm.mesAno(h.de)} a {vm.mesAno(h.ate)}</small></div>
              <div><dt>FS12</dt><dd className="num">{num(h.fs12)}</dd><small>folha de {vm.mesAno(h.folhaDe)} a {vm.mesAno(h.folhaAte)} ({h.defasagem} {h.defasagem === 1 ? 'mês' : 'meses'} depois do fato gerador)</small></div>
              <div className={h.mesesComReceita < 12 || h.mesesComFolha < 12 ? 'frp-falta-mes' : undefined}>
                <dt>Meses com número</dt><dd className="num">{h.mesesComReceita} · {h.mesesComFolha}</dd><small>de 12, receita · folha</small>
              </div>
            </dl>
          </div>
        ) : <div className="fc-corpo"><p className="hint">O mês de hoje não está nos anos desta projeção.</p></div>}
      </section>
      {v && v.fator != null && (
        <Alerta naLinha titulo={'Em ' + vm.mesAno(v.competencia) + ' o Fator R fica em ' + pct(v.fator) + ': Anexo V'}
          texto={'Faltam ' + vm.brl(v.folhaQueFalta ?? 0) + ' de folha nos 12 meses que entram nesse PA (a folha de ' + vm.mesAno(v.folhaDe) + ' a ' + vm.mesAno(v.folhaAte) + ') para chegar a ' + minimo + '.'} />
      )}
      <Grafico vm={vm} />
      <Tabela vm={vm} />
    </>
  );
}

function Tabela({ vm }: { vm: VmProjecaoDoFatorR }) {
  return (
    <section className="card fc-cartao">
      <header className="fc-cartao-topo">
        <h3 className="fc-cartao-titulo">Mês a mês<Dica texto="Cada linha é um mês: a receita e a folha pela competência (o fato gerador) e o Fator R do PA. A RBT12 é a receita dos 12 meses antes do PA; o FS12, a folha de 12 meses com a defasagem (no PA de 2026, a folha entra 2 meses depois do fato gerador; de 2027 em diante, 3), e embaixo dele vão os meses da folha somada. O número do PGDAS-D do robô não se digita; os outros, sim (grava ao sair do campo; apagar tira)." /></h3>
        {vm.gravando && <span className="fc-acoes fc-sub">Gravando…</span>}
      </header>
      <div className="table-wrap fc-tabela">
        <table className="table-compact frp-tabela">
          <thead><tr>
            <th>PA</th><th className="num">Receita do mês</th><th className="num">Folha do mês<small className="frp-th-sub">competência</small></th><th className="num">Fator do mês</th>
            <th className="num">RBT12</th><th className="num">FS12</th><th className="num">Fator R</th><th>Anexo</th><th className="num">Folha que falta</th>
          </tr></thead>
          <tbody>
            {vm.linhas.map((l, i) => {
              const novoAno = i === 0 || vm.linhas[i - 1].competencia.slice(0, 4) !== l.competencia.slice(0, 4);
              const incompleto = l.mesesComReceita < 12 || l.mesesComFolha < 12;
              return (
                <Fragment key={l.competencia}>
                  {novoAno && <tr className="fc-grupo"><th colSpan={9}>{l.competencia.slice(0, 4)} <span>{vm.daProjecao(l.competencia) ? '· a projeção: digite a receita e a folha que a empresa espera' : '· o ano anterior'}</span></th></tr>}
                  <tr className={vm.ehMesAtual(l.competencia) ? 'frp-atual' : undefined}>
                    <td className="frp-mes"><b>{vm.mesAno(l.competencia)}</b>{vm.ehMesAtual(l.competencia) && <small>o mês de hoje</small>}</td>
                    <td className="num"><Valor vm={vm} competencia={l.competencia} campo="receita" valor={l.receita} /></td>
                    <td className="num"><Valor vm={vm} competencia={l.competencia} campo="folha" valor={l.folha} /></td>
                    <td className={'num' + (l.fatorDoMes == null ? ' frp-fraco' : '')}>{pct(l.fatorDoMes)}</td>
                    <td className="num">{num(l.rbt12)}</td>
                    <td className="num frp-fs12">{num(l.fs12)}<small>folha {vm.mesAno(l.folhaDe)} a {vm.mesAno(l.folhaAte)}</small></td>
                    <td className={'num frp-fator' + (incompleto ? ' frp-incompleto' : '')}
                      title={incompleto ? 'Só ' + l.mesesComReceita + ' de 12 meses com receita e ' + l.mesesComFolha + ' com folha' : undefined}>{pct(l.fator)}</td>
                    <td>{l.anexo && <Selo anexo={l.anexo} curto />}</td>
                    <td className={'num' + (l.folhaQueFalta ? '' : ' frp-fraco')}>{l.folhaQueFalta ? num(l.folhaQueFalta) : '—'}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fc-pe">A folha do Fator R: salários, pró-labore, FGTS e CPP, pela competência. No FS12 ela entra com defasagem: no PA de 2026, 2 meses depois do fato gerador; de 2027 em diante, 3 (a folha de 10/2026 é a mais nova no PA de 01/2027). O Fator R é truncado em duas casas (27,99% fica no Anexo V).</p>
    </section>
  );
}

/** o número do mês: o do PGDAS-D só se vê; os outros se digitam na célula (vazio tira) */
function Valor({ vm, competencia, campo, valor }: { vm: VmProjecaoDoFatorR; competencia: string; campo: CampoDoMes; valor: tarefas.fatorR.ValorDoMes | null }) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const dica = vm.dicaDoValor(valor, campo);
  if (!vm.editavel(valor)) {
    return <span className="frp-valor" title={dica}><span className="frp-fonte frp-fonte-pgdas">PGDAS-D</span>{num((valor as tarefas.fatorR.ValorDoMes).valor)}</span>;
  }
  const noCampo = valor ? num(valor.valor) : '';
  const gravar = () => {
    if (rascunho !== null && rascunho.trim() !== noCampo) vm.mudar(competencia, campo, rascunho);
    setRascunho(null);
  };
  return (
    <span className="frp-valor" title={dica}>
      {valor?.fonte === 'pdf' && <span className="frp-fonte">PDF</span>}
      <input type="text" inputMode="decimal" className={'fin-valor-edita num' + (valor ? '' : ' fin-valor-edita-vazio')}
        aria-label={(campo === 'receita' ? 'Receita de ' : 'Folha de ') + vm.mesAno(competencia)}
        value={rascunho ?? noCampo} placeholder="digitar"
        onChange={e => setRascunho(e.target.value)} onBlur={gravar}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { setRascunho(null); e.currentTarget.blur(); } }} />
    </span>
  );
}
