// O balancete do SCI na Contabilização do minimum (27/11/2026, a etapa 2 do Vitor: "robo puxar o balancete no sci para verificar os
// saldos"): o robô do PC puxa o balancete do período (Ctrl+B no SCI, exportado em .xls) e ele aparece aqui, conta por conta, com
// o saldo anterior, o débito, o crédito e o saldo atual. Os saldos ao contrário da natureza ficam em vermelho. Fica guardado por
// empresa, só neste navegador; puxar de novo troca.
import { sci } from '@nads/core';
import { Icone, LogoSci, useRetorno } from '@nads/ui';
import { Fragment, useMemo, useRef, useState } from 'react';
import { AcoesDoTopo } from '../../../../comum/topo';
import { PuxarDoSci, SituacaoDoRobo } from './RazaoDoSci';
import { useContaDoBalancete } from './useContaDoBalancete';
import { rotuloDaCompetenciaDoSci, useLancamentosDoSciPeloRobo } from './useLancamentosDoSciPeloRobo';
import type { VmShadersCi } from './useShadersCi';

interface Guardado { arquivo: string; importadoEm: string; competencia: string; balancete: sci.BalanceteSci }
const PREFIXO = 'nads-minimum-balancete-v1|';
function lerGuardado(codigo: number | null): Guardado | null {
  if (codigo == null) return null;
  try { const g = JSON.parse(localStorage.getItem(PREFIXO + codigo) || 'null') as Guardado | null; return g && Array.isArray(g.balancete?.contas) ? g : null; } catch { return null; }
}
function gravarGuardado(codigo: number, g: Guardado) {
  try { localStorage.setItem(PREFIXO + codigo, JSON.stringify(g)); } catch { /* sem espaço: fica só na tela */ }
}

/** o saldo com o lado: positivo é devedor (D), negativo é credor (C) */
const saldoTexto = (v: number) => (v ? sci.valorParaTexto(Math.abs(v)) + (v > 0 ? ' D' : ' C') : '—');
const valorTexto = (v: number) => (v ? sci.valorParaTexto(v) : '—');
const dataTexto = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');

export function BalanceteDoSci({ vm }: { vm: VmShadersCi }) {
  const codigo = vm.empresa?.codigo ?? null;
  const { aviso } = useRetorno();
  const [guardado, setGuardado] = useState<Guardado | null>(() => lerGuardado(codigo));
  const [busca, setBusca] = useState('');
  const [soAnaliticas, setSoAnaliticas] = useState(false);
  // a conta aberta (o dropdown com os lançamentos e as provisões; 27/11/2026), pela classificação
  const [aberta, setAberta] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  async function importar(arquivo: File | undefined, competencia = '') {
    if (!arquivo || codigo == null) return;
    const r = await arquivo.arrayBuffer().then(b => sci.lerBalanceteDoSci(new Uint8Array(b), arquivo.name)).catch((e: unknown) => ({ balancete: null, erro: e instanceof Error ? e.message : String(e) }));
    if (!r.balancete) { aviso({ tom: 'info', titulo: 'Não é o balancete do SCI', texto: r.erro || '' }); return; }
    const g: Guardado = { arquivo: arquivo.name, importadoEm: new Date().toISOString(), competencia, balancete: r.balancete };
    gravarGuardado(codigo, g);
    setGuardado(g); setBusca('');
    aviso({ tom: 'ok', titulo: 'Balancete do SCI: ' + r.balancete.contas.filter(c => !c.participante).length + ' contas', texto: dataTexto(r.balancete.inicio) + ' a ' + dataTexto(r.balancete.fim) });
  }
  const robo = useLancamentosDoSciPeloRobo({ codigo, empresa: vm.empresa?.nome || '', tipo: 'sciBalancete', chegou: (f, c) => importar(f, c) });
  const b = guardado?.balancete || null;
  const invertidos = useMemo(() => new Set(b ? sci.saldosInvertidos(b).map(c => c.classificacao) : []), [b]);
  const q = sci.semAcento(busca.trim());
  const contas = (b?.contas || []).filter(c => (!soAnaliticas || c.analitica) && (!q || [c.classificacao, c.codigo, c.nome].some(v => sci.semAcento(v).includes(q))));
  // a prova do balancete: o débito e o crédito das analíticas (sem os participantes) batem
  const totais = useMemo(() => (b?.contas || []).filter(c => c.analitica).reduce((t, c) => ({ d: t.d + c.debito, c: t.c + c.credito }), { d: 0, c: 0 }), [b]);
  const recuo = (c: sci.ContaDoBalanceteSci) => Math.max(0, (c.nivel ?? c.classificacao.split('.').length) - 1);

  return (
    <>
      <AcoesDoTopo>
        <button type="button" className="btn btn-outline sci-btn-icone" onClick={() => vm.abrirApp(null)} title="Voltar aos apps" aria-label="Voltar aos apps"><Icone nome="chevronLeft" /></button>
        {b && robo.disponivel && <PuxarDoSci robo={robo} semTudo />}
        <button type="button" className="btn btn-outline sci-btn-icone" onClick={() => campo.current?.click()} title="Importar o balancete do SCI à mão (.xls, .xlsx ou .csv)" aria-label="Importar o balancete do SCI à mão"><Icone nome="upload" /></button>
      </AcoesDoTopo>
      <SituacaoDoRobo robo={robo} />
      <input ref={campo} type="file" accept=".xls,.xlsx,.csv" hidden onChange={e => { void importar(e.target.files?.[0]); e.target.value = ''; }} />
      {!b ? (
        // vazio, no padrão da tela inicial do minimum: a marca no meio e a barra larga com o período e o botão Vitor
        <div className="sci-inicio sci-contab-inicio">
          <span className="sci-inicio-marca">
            <span className="sci-contab-logo" aria-hidden="true"><LogoSci altura={52} /></span>
            <h1 className="sci-contab-titulo">Qual período do balancete?</h1>
          </span>
          <div className="sci-inicio-corpo sci-contab-corpo">
            {robo.disponivel
              ? <PuxarDoSci robo={robo} grande semTudo />
              : <button type="button" className="sci-escolher" onClick={() => campo.current?.click()}><Icone nome="upload" /><span className="sci-escolher-rotulo">Importar o balancete do SCI</span></button>}
          </div>
        </div>
      ) : (
        <>
          <div className="sci-balancete-cabeca">
            <div>
              <h2>Balancete de {dataTexto(b.inicio)} a {dataTexto(b.fim)}</h2>
              <p className="hint">
                {b.contas.filter(c => !c.participante).length} contas
                {invertidos.size > 0 && <> · <span className="sci-balancete-alerta">{invertidos.size === 1 ? '1 saldo ao contrário da natureza' : invertidos.size + ' saldos ao contrário da natureza'}</span></>}
                {guardado?.competencia && <> · puxado de {rotuloDaCompetenciaDoSci(guardado.competencia)}</>}
              </p>
            </div>
            <div className="sci-balancete-filtros">
              <label className="sci-balancete-so">
                <input type="checkbox" checked={soAnaliticas} onChange={e => setSoAnaliticas(e.target.checked)} />Só as analíticas
              </label>
              <label className="busca-curta">
                <Icone nome="search" />
                <input type="text" placeholder="Conta, classificação ou nome" value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }} aria-label="Buscar no balancete" />
              </label>
            </div>
          </div>
          <section className="card ini-grupo sci-tabela-card">
            <div className="table-wrap sci-tabela-caixa">
              <table className="table-compact ini-delegadas sci-tabela sci-balancete">
                <thead>
                  <tr>
                    <th>Classificação</th><th>Conta</th><th>Nome</th>
                    <th className="num">Saldo anterior</th><th className="num">Débito</th><th className="num">Crédito</th><th className="num">Saldo atual</th>
                  </tr>
                </thead>
                <tbody>
                  {contas.map((c, i) => {
                    const abre = c.analitica && !c.participante;
                    const estaAberta = abre && aberta === c.classificacao;
                    return (
                    <Fragment key={c.classificacao + '|' + i}>
                    <tr className={'ini-tr' + (c.analitica || c.participante ? '' : ' sci-balancete-sintetica') + (c.participante ? ' sci-balancete-participante' : '') + (abre ? ' sci-balancete-abre' : '') + (estaAberta ? ' aberta' : '')}
                      onClick={abre ? () => setAberta(a => (a === c.classificacao ? null : c.classificacao)) : undefined} aria-expanded={abre ? estaAberta : undefined}
                      title={abre ? 'Ver os lançamentos e as provisões da conta' : undefined}>
                      <td className="ini-delegadas-curta sci-balancete-class">{abre && <Icone nome={estaAberta ? 'chevronDown' : 'chevronRight'} width={14} height={14} />}{c.classificacao}</td>
                      <td className="ini-delegadas-curta">{c.participante ? '' : c.codigo}</td>
                      <td><span style={{ paddingLeft: recuo(c) * 14 }}>{c.nome}</span></td>
                      <td className="num">{saldoTexto(c.anterior)}</td>
                      <td className="num">{valorTexto(c.debito)}</td>
                      <td className="num">{valorTexto(c.credito)}</td>
                      <td className={'num' + (invertidos.has(c.classificacao) ? ' sci-balancete-invertido' : '')} title={invertidos.has(c.classificacao) ? 'Saldo ao contrário da natureza da conta' : undefined}>{saldoTexto(c.atual)}</td>
                    </tr>
                    {estaAberta && <tr className="sci-balancete-painel-linha"><td colSpan={7}><ContaAberta vm={vm} b={b} conta={c} /></td></tr>}
                    </Fragment>
                    );
                  })}
                  {!contas.length && <tr><td colSpan={7} className="hint sci-razao-nada">Nenhuma conta com essa busca.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="sci-balancete-total">
                    <td colSpan={4}>Movimento das analíticas{totais.d === totais.c ? ' · débito e crédito batem' : ' · não bate: diferença de ' + sci.valorParaTexto(Math.abs(totais.d - totais.c))}</td>
                    <td className="num">{sci.valorParaTexto(totais.d)}</td>
                    <td className="num">{sci.valorParaTexto(totais.c)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
          <p className="hint sci-razao-pe">Última importação: {guardado?.arquivo} · {new Date(guardado?.importadoEm || 0).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </>
      )}
    </>
  );
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? MESES[Number(m.slice(5)) - 1] + '/' + m.slice(0, 4) : m);
const ROTULO_DA_SITUACAO = { pago: 'Pago', parcial: 'Parcial', aberto: 'Sem pagamento' } as const;

/**
 * A conta aberta no balancete (27/11/2026, o Vitor: "o relatorio de todos os lancamentos de cada conta em um dropdown ... ver as
 * provisoes ... quais meses tao com pagamento e quais estao sem ... com um botao ele ja gerar os lancamentos e pagar sem esforco").
 */
function ContaAberta({ vm, b, conta }: { vm: VmShadersCi; b: sci.BalanceteSci; conta: sci.ContaDoBalanceteSci }) {
  const c = useContaDoBalancete(vm, b, conta);
  if (c.semLancamentos) return <p className="hint sci-conta-vazia">Puxe os lançamentos do SCI na aba <b>Lançamentos</b> (o botão Vitor, "Tudo") para ver aqui os lançamentos e as provisões desta conta.</p>;
  const p = c.provisoes;
  const porBanco = c.previa.filter(x => x.pelo === 'banco').length;
  return (
    <div className="sci-conta">
      {p && (
        <section className="sci-conta-provisoes">
          <header>
            <h3>Provisões por mês</h3>
            <span className="hint">{p.lado === 'credito' ? 'A provisão é o crédito; o pagamento, o débito' : 'A provisão é o débito; o recebimento, o crédito'}</span>
          </header>
          {p.meses.length ? (
            <div className="sci-conta-meses">
              {p.meses.map(m => (
                <div key={m.mes} className={'sci-conta-mes ' + m.situacao} title={'Provisionado ' + valorTexto(m.provisionado) + ' · pago ' + valorTexto(m.pago)}>
                  <b>{mesCurto(m.mes)}</b>
                  <span className="sci-conta-mes-valor">{valorTexto(m.provisionado)}</span>
                  <span className="sci-conta-mes-situacao">{ROTULO_DA_SITUACAO[m.situacao]}{m.situacao === 'parcial' ? ': falta ' + valorTexto(m.aberto) : ''}</span>
                </div>
              ))}
            </div>
          ) : <p className="hint">Nenhuma provisão nos lançamentos puxados.</p>}
          {p.aberto > 0 && (
            <div className="sci-conta-pagar">
              <p><b>{valorTexto(p.aberto)}</b> sem pagamento em {p.meses.filter(m => m.aberto).length === 1 ? '1 mês' : p.meses.filter(m => m.aberto).length + ' meses'}.
                {c.extrato ? <> Com o extrato da aba Extratos ({c.extrato.arquivo}), {porBanco === 1 ? '1 sai' : porBanco + ' saem'} pelo banco; o resto, pelo caixa.</> : <> Sem extrato na aba Extratos: tudo pelo caixa.</>}</p>
              <div className="sci-conta-campos">
                <label>Caixa<input className="input" value={c.caixa} onChange={e => c.setCaixa(e.target.value.trim())} placeholder="código" /><small>{c.nomeDoCaixa || '—'}</small></label>
                <label>Banco<input className="input" value={c.banco} onChange={e => c.setBanco(e.target.value.trim())} placeholder="código" /><small>{c.nomeDoBanco || (c.extrato ? '—' : 'sem extrato')}</small></label>
                <label>Histórico<input className="input" value={c.historico} onChange={e => c.setHistorico(e.target.value.replace(/\D/g, ''))} placeholder="nº no SCI" /><small>do pagamento</small></label>
                <button type="button" className="btn btn-primary" disabled={c.gerando || !c.previa.length} onClick={c.gerar}>
                  <Icone nome="download" />{c.gerando ? 'Gerando…' : 'Gerar ' + (c.previa.length === 1 ? '1 pagamento' : c.previa.length + ' pagamentos')}
                </button>
              </div>
              {c.previa.length > 0 && (
                <ul className="sci-conta-previa">
                  {c.previa.map((x, i) => (
                    <li key={i}><span className={'sci-conta-pelo ' + x.pelo}>{x.pelo === 'banco' ? 'Banco' : 'Caixa'}</span>{dataTexto(x.lancamento.data)} · {valorTexto(x.lancamento.valor)} · D {x.lancamento.debito} × C {x.lancamento.credito} · {x.lancamento.complemento}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
      <section className="sci-conta-lancamentos">
        <header><h3>Lançamentos da conta</h3><span className="hint">{c.lancamentos.length === 1 ? '1 lançamento' : c.lancamentos.length + ' lançamentos'} puxados do SCI</span></header>
        <table className="table-compact">
          <thead><tr><th>Data</th><th className="num">Débito</th><th className="num">Crédito</th><th>Contrapartida</th><th>Histórico</th></tr></thead>
          <tbody>
            {c.lancamentos.slice(0, 300).map((l, i) => {
              const debito = l.debito === conta.codigo;
              const contra = debito ? l.credito : l.debito;
              return (
                <tr key={i}>
                  <td>{dataTexto(l.data)}</td>
                  <td className="num">{debito ? valorTexto(l.valor) : ''}</td>
                  <td className="num">{debito ? '' : valorTexto(l.valor)}</td>
                  <td>{contra ? contra + (c.nomeDa(contra) ? ' · ' + c.nomeDa(contra) : '') : '—'}</td>
                  <td className="sci-conta-hist">{l.complemento}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

