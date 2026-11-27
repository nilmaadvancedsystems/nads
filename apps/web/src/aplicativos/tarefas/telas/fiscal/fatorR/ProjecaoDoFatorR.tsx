// Fiscal › Projeção do Fator R (26/11/2026: a planilha "PROJEÇÃO FATOR R 6.0" do Fiscal; o visual refeito em 27/11/2026 e
// simplificado no mesmo dia: "só faz não ficar tão poluído e estranho"; o bloco do Fator R de hoje saiu: "remove isso"). De cima para baixo:
//   - a barra: a empresa, o ano da projeção e as ações (PDF do PGDAS-D, Excel, Imprimir);
//   - a evolução do Fator R em linha (as faixas dos anexos ao fundo, a linha dos 28%, a projeção sombreada e a dica);
//   - a tabela mês a mês, uma só (o ano anterior e o da projeção seguidos): a receita e a folha pela competência (digitadas
//     na célula quando não vêm do PGDAS-D), o fator do mês, a RBT12, o FS12, os meses da folha somada, o Fator R, o Anexo e
//     a folha que falta.
// Só peças do catálogo por fora (EmpresaDaBarra, Alerta, Dica, Vazio, Esqueleto, Icone); o desenho é o desta tela.
import { Alerta, Dica, Esqueleto, Icone, LogoExcel, LogoSimplesNacional, useCarregando, Vazio } from '@nads/ui';
import type { tarefas } from '@nads/core';
import { Fragment, useState } from 'react';
import { EmpresaDaBarra } from '../partes/EmpresaDaBarra';
import { useProjecaoDoFatorR, type CampoDoMes, type VmProjecaoDoFatorR } from './useProjecaoDoFatorR';
import './projecaoDoFatorR.css';

const num = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number | null) => (n == null ? '—' : num(n) + '%');
const pctCurto = (n: number) => num(n).replace(',00', '') + '%';

export function ProjecaoDoFatorR() {
  const vm = useProjecaoDoFatorR();
  useCarregando(vm.carregando || vm.lendoPdf);
  if (!vm.pode) {
    return <section className="frx"><div className="frx-cartao frx-vazio"><Vazio icone="lock" titulo="Só o Fiscal e o admin usam a Projeção do Fator R" texto="Peça a quem é do Fiscal." /></div></section>;
  }
  return (
    <section className="frx">
      <header className="frx-topo">
        <EmpresaDaBarra vm={vm} id="fator-r-empresas" />
        <div className="frx-anos" role="group" aria-label="Ano da projeção">
          <button type="button" className="frx-ano-seta" onClick={vm.anoAnterior} aria-label="Ano anterior"><Icone nome="chevronLeft" width={16} height={16} /></button>
          <span className="frx-ano"><small>Projeção</small><b>{vm.ano}</b></span>
          <button type="button" className="frx-ano-seta" onClick={vm.anoSeguinte} aria-label="Ano seguinte"><Icone nome="chevronRight" width={16} height={16} /></button>
        </div>
        <span className="frx-espaco" />
        <div className="frx-acoes">
          <label className={'frx-acao' + (vm.temRelatorio && !vm.lendoPdf ? '' : ' frx-acao-apagada')} aria-disabled={!vm.temRelatorio || vm.lendoPdf}>
            <span className="frx-logo"><LogoSimplesNacional /></span>{vm.lendoPdf ? 'Lendo…' : 'PDF do PGDAS-D'}
            <input type="file" accept="application/pdf,.pdf" className="frx-arquivo" disabled={!vm.temRelatorio || vm.lendoPdf}
              onChange={e => { const a = e.target.files?.[0]; e.target.value = ''; void vm.subirPdf(a); }} />
          </label>
          <button type="button" className="frx-acao" disabled={!vm.temRelatorio} onClick={vm.exportar}><span className="frx-logo"><LogoExcel /></span>Excel</button>
          <button type="button" className="frx-acao" disabled={!vm.temRelatorio} onClick={vm.imprimir}><Icone nome="printer" width={16} height={16} />Imprimir</button>
        </div>
      </header>
      {vm.exemplos && <p className="frx-exemplo"><Icone nome="ajuda" width={14} height={14} />Dados de exemplo: números inventados; o ano corrente como se o robô do e-CAC já tivesse baixado o PGDAS-D.</p>}
      {vm.erro && <Alerta naLinha titulo={vm.erro} onFechar={vm.fecharErro} />}

      {!vm.empresa ? <Inicio />
        : vm.carregando ? <Esqueleto linhas={10} />
        : vm.falhou ? <div className="frx-cartao frx-vazio"><Vazio icone="alert" titulo="Não deu para ler a projeção" texto="Sem permissão ou sem internet. Recarregue a página." /></div>
        : (
          <>
            {vm.foraDoSimples && <Alerta naLinha titulo={'Esta empresa é do ' + vm.regime} texto="O Fator R só vale no Simples Nacional. A conta sai do mesmo jeito." />}
            <Evolucao vm={vm} />
            <Tabela vm={vm} />
          </>
        )}
    </section>
  );
}

/** sem empresa: o que a ferramenta faz, em três passos */
function Inicio() {
  const passos: [string, string][] = [
    ['Escolha a empresa', 'pelo código ou pelo nome, na barra de cima'],
    ['Confira os meses', 'a receita vem do PGDAS-D do robô; o que faltar se digita ou sai do PDF do extrato'],
    ['Projete o ano', 'digite a receita e a folha esperadas e veja em que mês o Fator R passa ou cai dos 28%'],
  ];
  return (
    <div className="frx-cartao frx-inicio">
      <div className="frx-inicio-titulo">
        <span className="frx-inicio-icone"><Icone nome="barChart" width={22} height={22} /></span>
        <div><h2>Projeção do Fator R</h2><p>A folha dos 12 meses ÷ a receita dos 12 meses: de 28% para cima, Anexo III; abaixo, Anexo V.</p></div>
      </div>
      <ol className="frx-passos">
        {passos.map(([t, d], i) => <li key={t}><b>{i + 1}</b><span><strong>{t}</strong>{d}</span></li>)}
      </ol>
    </div>
  );
}

/** o Anexo com cor, ícone e texto (a cor nunca sozinha) */
function Selo({ anexo, curto }: { anexo: 'III' | 'V'; curto?: boolean }) {
  return <span className={'frx-selo frx-selo-' + anexo}><Icone nome={anexo === 'III' ? 'check' : 'alert'} width={12} height={12} />{curto ? anexo : 'Anexo ' + anexo}</span>;
}

/** a evolução do Fator R em linha: as faixas dos anexos ao fundo, a linha dos 28%, a projeção sombreada e a dica */
function Evolucao({ vm }: { vm: VmProjecaoDoFatorR }) {
  const [foco, setFoco] = useState<number | null>(null);
  const { barras: pts, escala } = vm.grafico;
  const L = 44, R = 16, T = 18, B = 42, W = 1100, H = 300;
  const passo = (W - L - R) / Math.max(1, pts.length - 1);
  const x = (i: number) => L + passo * i;
  const y = (p: number) => T + (H - T - B) * (1 - Math.min(p, escala) / escala);
  const minimo = vm.minimo;
  const iProjecao = pts.findIndex(p => p.projecao);
  // a linha em pedaços (o PA sem Fator R corta a linha); a parte da projeção tracejada
  const trecho = (de: number, ate: number) => {
    let d = '', aberto = false;
    for (let i = de; i <= ate; i++) {
      const p = pts[i];
      if (!p || p.fator == null) { aberto = false; continue; }
      d += (aberto ? ' L' : ' M') + x(i) + ',' + y(p.fator);
      aberto = true;
    }
    return d.trim();
  };
  const fimReal = iProjecao > 0 ? iProjecao : pts.length - 1;
  const marcas = Array.from({ length: escala / 10 + 1 }, (_, i) => i * 10);
  const b = foco != null ? pts[foco] : null;
  return (
    <section className="frx-cartao">
      <header className="frx-cartao-topo">
        <h3>Evolução do Fator R<Dica texto="Cada ponto é o Fator R de um PA. A linha tracejada é a projeção; o ponto vazado é a janela que ainda não tem os 12 meses com receita e folha." /></h3>
        <span className="frx-legenda">
          <span><i className="frx-leg frx-leg-III" />Anexo III</span>
          <span><i className="frx-leg frx-leg-V" />Anexo V</span>
          <span><i className="frx-leg frx-leg-linha" />{pctCurto(minimo)}</span>
        </span>
      </header>
      <div className="frx-grafico" onMouseLeave={() => setFoco(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A evolução do Fator R de cada PA; os números estão na tabela embaixo">
          <rect className="frx-g-faixa-III" x={L} y={y(escala)} width={W - L - R} height={y(minimo) - y(escala)} />
          <rect className="frx-g-faixa-V" x={L} y={y(minimo)} width={W - L - R} height={y(0) - y(minimo)} />
          {iProjecao > 0 && <rect className="frx-g-projecao" x={x(iProjecao) - passo / 2} y={T} width={W - R - x(iProjecao) + passo / 2} height={H - T - B} />}
          {iProjecao > 0 && <text className="frx-g-rotulo" x={x(iProjecao) - passo / 2 + 8} y={T + 14}>PROJEÇÃO {vm.ano}</text>}
          {marcas.map(mk => (
            <g key={mk}>
              <line className="frx-g-grade" x1={L} x2={W - R} y1={y(mk)} y2={y(mk)} />
              <text className="frx-g-eixo" x={L - 8} y={y(mk) + 4} textAnchor="end">{mk}%</text>
            </g>
          ))}
          <line className="frx-g-minimo" x1={L} x2={W - R} y1={y(minimo)} y2={y(minimo)} />
          <text className="frx-g-minimo-rotulo" x={W - R - 4} y={y(minimo) - 6} textAnchor="end">{pctCurto(minimo)}</text>
          {foco != null && <line className="frx-g-mira" x1={x(foco)} x2={x(foco)} y1={T} y2={H - B} />}
          <path className="frx-g-linha" d={trecho(0, fimReal)} />
          {iProjecao > 0 && <path className="frx-g-linha frx-g-linha-projecao" d={trecho(iProjecao - 1, pts.length - 1)} />}
          {pts.map((p, i) => (
            <g key={p.competencia}>
              {p.fator != null && (
                <circle cx={x(i)} cy={y(p.fator)} r={foco === i ? 6 : 4.5}
                  className={'frx-g-ponto frx-g-ponto-' + p.anexo + (p.incompleto ? ' frx-g-ponto-vazado' : '')} />
              )}
              <text className={'frx-g-mes' + (p.atual ? ' frx-g-atual' : '')} x={x(i)} y={H - B + 18} textAnchor="middle">{p.mes}</text>
              {(i === 0 || p.mes === 'jan') && <text className="frx-g-ano" x={x(i)} y={H - B + 34} textAnchor="middle">{p.ano}</text>}
              <rect className="frx-g-alvo" x={x(i) - passo / 2} y={T} width={passo} height={H - T - B + 24} onMouseEnter={() => setFoco(i)} />
            </g>
          ))}
        </svg>
        {b && foco != null && (
          <div className={'frx-dica' + (foco > pts.length / 2 ? ' frx-dica-esq' : '')} style={{ left: (x(foco) / W) * 100 + '%' }}>
            <span className="frx-dica-topo"><b>PA {vm.mesAno(b.competencia)}</b>{b.anexo && <Selo anexo={b.anexo} curto />}</span>
            <span className="frx-dica-fator num">{pct(b.fator)}</span>
            <span className="frx-dica-linha">RBT12 <b className="num">{num(b.rbt12)}</b></span>
            <small>receita {vm.mesAno(b.de)} a {vm.mesAno(b.ate)}</small>
            <span className="frx-dica-linha">FS12 <b className="num">{num(b.fs12)}</b></span>
            <small>folha {vm.mesAno(b.folhaDe)} a {vm.mesAno(b.folhaAte)}</small>
            {!!b.folhaQueFalta && <span className="frx-dica-linha frx-dica-falta">Falta de folha <b className="num">{num(b.folhaQueFalta)}</b></span>}
            {b.incompleto && <small>janela sem os 12 meses</small>}
          </div>
        )}
      </div>
    </section>
  );
}

/** a tabela mês a mês: uma só, o ano anterior e o da projeção seguidos */
function Tabela({ vm }: { vm: VmProjecaoDoFatorR }) {
  return (
    <section className="frx-cartao">
      <header className="frx-cartao-topo">
        <h3>Mês a mês<Dica texto="A receita e a folha de cada mês (pela competência). O Fator R do PA é a folha dos meses da coluna Folha usada ÷ a receita dos 12 meses antes do PA. Passe o mouse na linha para ver a RBT12 e o FS12. O número do PGDAS-D do robô não se digita; os outros, sim: grava ao sair do campo, e apagar tira." /></h3>
        {vm.gravando && <span className="frx-gravando">Gravando…</span>}
      </header>
      <div className="frx-tabela-caixa">
        <table className="frx-tabela">
          <thead>
            <tr>
              <th>PA</th><th className="num">Receita do mês</th><th className="num">Folha do mês</th><th className="frx-col-usada">Folha usada no Fator R</th>
              <th className="num">Fator R</th><th className="num">Falta p/ {pctCurto(vm.minimo)}</th>
            </tr>
          </thead>
          <tbody>
            {vm.linhas.map((l, i) => {
              const incompleto = l.mesesComReceita < 12 || l.mesesComFolha < 12;
              const atual = vm.ehMesAtual(l.competencia);
              const novoAno = i === 0 || vm.linhas[i - 1].competencia.slice(0, 4) !== l.competencia.slice(0, 4);
              return (
                <Fragment key={l.competencia}>
                  {novoAno && <tr className="frx-ano-linha"><td colSpan={6}>{l.competencia.slice(0, 4)} <span>{vm.daProjecao(l.competencia) ? 'projeção' : 'o ano anterior'}</span></td></tr>}
                  <tr className={atual ? 'frx-atual' : undefined} title={'RBT12 ' + num(l.rbt12) + ' (receita ' + vm.mesAno(l.de) + ' a ' + vm.mesAno(l.ate) + ')  ·  FS12 ' + num(l.fs12) + (incompleto ? '  ·  só ' + l.mesesComReceita + ' de 12 meses com receita e ' + l.mesesComFolha + ' com folha' : '')}>
                    <td className="frx-pa">{vm.mesAno(l.competencia)}{atual && <small>hoje</small>}</td>
                    <td className="num"><Valor vm={vm} competencia={l.competencia} campo="receita" valor={l.receita} /></td>
                    <td className="num"><Valor vm={vm} competencia={l.competencia} campo="folha" valor={l.folha} /></td>
                    <td className="frx-somada">{vm.mesAno(l.folhaDe)} a {vm.mesAno(l.folhaAte)}</td>
                    <td className={'num frx-fator' + (l.anexo ? ' frx-fator-' + l.anexo : '') + (incompleto ? ' frx-incompleto' : '')}>
                      {l.fator == null ? <span className="frx-fraco">—</span> : <span className="frx-fator-caixa">{pct(l.fator)}{l.anexo && <Selo anexo={l.anexo} curto />}</span>}
                    </td>
                    <td className={'num' + (l.folhaQueFalta ? '' : ' frx-fraco')}>{l.folhaQueFalta ? num(l.folhaQueFalta) : '—'}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="frx-pe"><i className="frx-ponto-pgdas" /> do PGDAS-D do robô (não se digita). Folha do Fator R: salários, pró-labore, FGTS e CPP, pela competência. A folha usada vai até o mês antes do PA em 2026 e até 2 meses antes de 2027 em diante. O Fator R é truncado em duas casas (27,99% fica no Anexo V).</p>
    </section>
  );
}

/** o número do mês: o do PGDAS-D só se vê; os outros se digitam na célula (vazio tira) */
function Valor({ vm, competencia, campo, valor }: { vm: VmProjecaoDoFatorR; competencia: string; campo: CampoDoMes; valor: tarefas.fatorR.ValorDoMes | null }) {
  const [rascunho, setRascunho] = useState<string | null>(null);
  const dica = vm.dicaDoValor(valor, campo);
  if (!vm.editavel(valor)) {
    return <span className="frx-valor frx-valor-pgdas" title={dica}><i className="frx-ponto-pgdas" aria-label="do PGDAS-D" />{num((valor as tarefas.fatorR.ValorDoMes).valor)}</span>;
  }
  const noCampo = valor ? num(valor.valor) : '';
  const gravar = () => {
    if (rascunho !== null && rascunho.trim() !== noCampo) vm.mudar(competencia, campo, rascunho);
    setRascunho(null);
  };
  return (
    <span className="frx-valor" title={dica}>
      <input type="text" inputMode="decimal" className={'frx-campo num' + (valor ? '' : ' frx-campo-vazio')}
        aria-label={(campo === 'receita' ? 'Receita de ' : 'Folha de ') + vm.mesAno(competencia)}
        value={rascunho ?? noCampo} placeholder="—"
        onChange={e => setRascunho(e.target.value)} onBlur={gravar}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { setRascunho(null); e.currentTarget.blur(); } }} />
      {valor?.fonte === 'pdf' && <i>PDF</i>}
    </span>
  );
}
