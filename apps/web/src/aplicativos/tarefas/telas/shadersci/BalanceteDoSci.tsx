// O balancete do SCI na Contabilização do minimum (27/11/2026, a etapa 2 do Vitor: "robo puxar o balancete no sci para verificar os
// saldos"): o robô do PC puxa o balancete do período (Ctrl+B no SCI, exportado em .xls) e ele aparece aqui, conta por conta, com
// o saldo anterior, o débito, o crédito e o saldo atual. Os saldos ao contrário da natureza ficam em vermelho. Fica guardado por
// empresa, só neste navegador; puxar de novo troca. Na interface de sempre do nads (27/11/2026, o Vitor: "faz o programa na interface
// do nads, precisa ser visual diferente nao, pra nao confundir o usuario ... a tabela e a interface"): o card com a faixa do título,
// a tabela compacta e as etiquetas (badge).
import { sci } from '@nads/core';
import { Icone, Vazio, useRetorno } from '@nads/ui';
import { Fragment, useMemo, useRef, useState } from 'react';
import { AcoesDoTopo } from '../../../../comum/topo';
import { PuxarDoSci, SituacaoDoRobo } from './RazaoDoSci';
import { Paleta } from './Paleta';
import { useContaDoBalancete, useFechamentoDoBalancete } from './useContaDoBalancete';
import { rotuloDaCompetenciaDoSci, useLancamentosDoSciPeloRobo } from './useLancamentosDoSciPeloRobo';
import type { VmShadersCi } from './useShadersCi';

export interface Guardado { arquivo: string; importadoEm: string; competencia: string; balancete: sci.BalanceteSci }
const PREFIXO = 'nads-minimum-balancete-v1|';
function lerGuardado(codigo: number | null): Guardado | null {
  if (codigo == null) return null;
  try { const g = JSON.parse(localStorage.getItem(PREFIXO + codigo) || 'null') as Guardado | null; return g && Array.isArray(g.balancete?.contas) ? g : null; } catch { return null; }
}
/** o balancete guardado (a Importação mostra e troca; 27/11/2026) */
export type BalanceteGuardado = Guardado;
export const balanceteGuardado = (codigo: number | null) => lerGuardado(codigo);
export const gravarBalancete = (codigo: number, g: Guardado) => gravarGuardado(codigo, g);
/** o balancete que a empresa tem neste navegador (o fluxo da Contabilização vê se o passo 2 está feito; o fechamento usa) */
export const balanceteDaEmpresa = (codigo: number | null): sci.BalanceteSci | null => lerGuardado(codigo)?.balancete || null;
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
        // vazio, na interface de sempre do nads (27/11/2026: "o resto siga o padrao nads de design")
        <section className="card">
          <Vazio icone="calendar" titulo="Qual período do balancete?" texto={robo.disponivel ? 'O robô do PC de ' + robo.rotulo + ' puxa o balancete do SCI.' : 'Traga o balancete exportado do SCI (.xls).'}>
            {robo.disponivel ? <PuxarDoSci robo={robo} semTudo /> : <button type="button" className="btn btn-primary" onClick={() => campo.current?.click()}><Icone nome="upload" />Importar o balancete</button>}
          </Vazio>
        </section>
      ) : (
        <>
          <section className="card">
            <div className="card-head">
              <h3>Balancete de {dataTexto(b.inicio)} a {dataTexto(b.fim)}</h3>
              <span className="badge badge-neutral">{b.contas.filter(c => !c.participante).length} contas</span>
              {invertidos.size > 0 && <span className="badge badge-bad" title="Saldo ao contrário da natureza da conta">{invertidos.size === 1 ? '1 saldo invertido' : invertidos.size + ' saldos invertidos'}</span>}
              {guardado?.competencia && <span className="hint">puxado de {rotuloDaCompetenciaDoSci(guardado.competencia)}</span>}
              <span style={{ flex: 1 }} />
              <label className="card-head-ctl"><input type="checkbox" checked={soAnaliticas} onChange={e => setSoAnaliticas(e.target.checked)} />Só as analíticas</label>
              <input className="input" style={{ width: 220 }} type="text" placeholder="Conta, classificação ou nome" value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setBusca(''); }} aria-label="Buscar no balancete" />
            </div>
            <div className="table-wrap bal-tabela">
              <table className="table-compact">
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
                        <tr className={(c.analitica || c.participante ? '' : 'bal-sintetica') + (c.participante ? ' bal-participante' : '') + (abre ? ' bal-abre' : '')}
                          onClick={abre ? () => setAberta(a => (a === c.classificacao ? null : c.classificacao)) : undefined} aria-expanded={abre ? estaAberta : undefined}
                          title={abre ? 'Ver os lançamentos e as provisões da conta' : undefined}>
                          <td className="bal-class">{abre && <Icone nome={estaAberta ? 'chevronDown' : 'chevronRight'} width={14} height={14} />}{c.classificacao}</td>
                          <td>{c.participante ? '' : c.codigo}</td>
                          <td><span style={{ paddingLeft: recuo(c) * 14 }}>{c.nome}</span></td>
                          <td className="num">{saldoTexto(c.anterior)}</td>
                          <td className="num">{valorTexto(c.debito)}</td>
                          <td className="num">{valorTexto(c.credito)}</td>
                          <td className={'num' + (invertidos.has(c.classificacao) ? ' bal-invertido' : '')} title={invertidos.has(c.classificacao) ? 'Saldo ao contrário da natureza da conta' : undefined}>{saldoTexto(c.atual)}</td>
                        </tr>
                        {estaAberta && <tr className="bal-painel"><td colSpan={7}><ContaAberta vm={vm} b={b} conta={c} /></td></tr>}
                      </Fragment>
                    );
                  })}
                  {!contas.length && <tr><td colSpan={7} className="hint">Nenhuma conta com essa busca.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="bal-total">
                    <td colSpan={4}>Movimento das analíticas {totais.d === totais.c ? <span className="badge badge-ok">débito e crédito batem</span> : <span className="badge badge-bad">diferença de {sci.valorParaTexto(Math.abs(totais.d - totais.c))}</span>}</td>
                    <td className="num">{sci.valorParaTexto(totais.d)}</td>
                    <td className="num">{sci.valorParaTexto(totais.c)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
          <p className="hint">Última importação: {guardado?.arquivo} · {new Date(guardado?.importadoEm || 0).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </>
      )}
    </>
  );
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? MESES[Number(m.slice(5)) - 1] + '/' + m.slice(0, 4) : m);
const SITUACAO = { pago: ['badge badge-ok', 'Pago'], parcial: ['badge badge-warn', 'Parcial'], aberto: ['badge badge-bad', 'Sem pagamento'] } as const;
const comSinal = (v: number) => (v < 0 ? '−' : '') + sci.valorParaTexto(Math.abs(v));
const pelo = (q: 'banco' | 'caixa') => <span className={q === 'banco' ? 'badge badge-ok' : 'badge badge-warn'}>{q === 'banco' ? 'Banco' : 'Caixa'}</span>;

/** Os campos de sempre do nads, com o rótulo em cima e o nome da conta embaixo. */
function Campo({ rotulo, valor, mudar, dica, placeholder, numero }: { rotulo: string; valor: string; mudar: (v: string) => void; dica?: string; placeholder?: string; numero?: boolean }) {
  return (
    <label className="bal-campo">
      <span>{rotulo}</span>
      <input className="input" value={valor} onChange={e => mudar(numero ? e.target.value.replace(/\D/g, '') : e.target.value.trim())} placeholder={placeholder} />
      {dica !== undefined && <small className="hint">{dica || '—'}</small>}
    </label>
  );
}

/**
 * O fechamento do período (27/11/2026, o Vitor: "Exportar uma planilha com tudo pago, conciliacao bancaria com o extrato batendo e o
 * que nao tem no banco jogar caixa"): as provisões abertas de todas as contas, pagas numa planilha só, com a conferência do banco e do
 * caixa e o que sobrou do extrato.
 */
/** O passo 4 do fluxo da Contabilização: o fechamento, com o balancete que o passo 2 trouxe. */
export function FechamentoDoPeriodo({ vm }: { vm: VmShadersCi }) {
  const b = balanceteDaEmpresa(vm.empresa?.codigo ?? null);
  if (!b) return <section className="card"><Vazio icone="scale" titulo="Falta o balancete" texto="Traga o balancete do SCI na Importação: o fechamento usa o período e as contas dele." /></section>;
  return <Fechamento vm={vm} b={b} />;
}

function Fechamento({ vm, b }: { vm: VmShadersCi; b: sci.BalanceteSci }) {
  const f = useFechamentoDoBalancete(vm, b);
  const x = f.fechamento;
  // a busca no plano (27/11/2026: "em cada um dos lancamentos o usuario vai poder pesquisar no plano de contas"): a contrapartida de um
  // pagamento ou a conta de uma linha do extrato sem provisão
  const [busca, setBusca] = useState<{ tipo: 'troca' | 'extrato'; chave: string } | null>(null);
  const contaNaTabela = (c: string) => (c ? c + (f.nomeDa(c) ? ' · ' + f.nomeDa(c) : '') : '—');
  return (
    <section className="card">
      {busca && (
        <Paleta itens={f.itensDoPlano} rotulo="Escolher a conta no plano" placeholder="Buscar a conta pelo código ou pelo nome" unidade={['conta', 'contas']}
          fechar={() => setBusca(null)} escolher={c => { if (busca.tipo === 'troca') f.trocar(busca.chave, c); else f.lancarLinha(busca.chave, c); setBusca(null); }} />
      )}
      <div className="card-head">
        <h3>Fechamento de {mesCurto(f.de)} a {mesCurto(f.ate)}</h3>
        {x && (x.pagamentos.length
          ? <span className="badge badge-warn">{x.pagamentos.length === 1 ? '1 provisão sem pagamento' : x.pagamentos.length + ' provisões sem pagamento'}</span>
          : <span className="badge badge-ok">tudo pago</span>)}
        {x && x.extratoSemProvisao.length > 0 && <span className="badge badge-bad">{x.extratoSemProvisao.length} do extrato sem conta</span>}
        <span style={{ flex: 1 }} />
        {x && x.lancamentos.length > 0 && (
          <button type="button" className="btn btn-primary" disabled={f.gerando} onClick={f.pagarTudo}><Icone nome="download" />{f.gerando ? 'Gerando…' : 'Pagar tudo e baixar a planilha'}</button>
        )}
      </div>
      {f.semLancamentos ? (
        <p className="hint" style={{ margin: 0 }}>Traga os lançamentos do SCI na <b>Importação</b> (o botão Vitor, "Tudo"): o fechamento usa as provisões deles.</p>
      ) : (
        <>
          <div className="bal-campos">
            <Campo rotulo="Caixa" valor={f.caixa} mudar={f.setCaixa} dica={f.nomeDoCaixa} placeholder="código" />
            <Campo rotulo="Banco" valor={f.banco} mudar={f.setBanco} dica={f.nomeDoBanco} placeholder="código" />
            <Campo rotulo="Multa e juros" valor={f.juros} mudar={f.setJuros} dica={f.nomeDosJuros} placeholder="código" />
            <Campo rotulo="Histórico do pagamento" valor={f.historicoPagamento} mudar={f.setHistoricoPagamento} placeholder="nº no SCI" numero dica="813 Pagamento de título nº" />
            {f.temRecebimento && <Campo rotulo="Histórico do recebimento" valor={f.historicoRecebimento} mudar={f.setHistoricoRecebimento} placeholder="nº no SCI" numero dica="478 Recebimento de clientes cfe NF nº" />}
          </div>
          <div className="bal-campos" style={{ marginTop: 0 }}>
            <label className="card-head-ctl"><input type="checkbox" checked={f.caixaLigado} onChange={e => f.setCaixaLigado(e.target.checked)} />O que não está no extrato vai para o caixa</label>
            <p className="hint bal-extrato" style={{ marginTop: 0 }}>{f.extrato ? <>Extrato da Importação: <b>{f.extrato.arquivo}</b>. O que ele mostra sai pelo banco (com a multa e os juros, se pagou a mais).</> : <>Sem extrato na Importação: nada sai pelo banco.</>}</p>
          </div>
          {x && (
            <div className="table-wrap" style={{ maxHeight: 'none', marginTop: 12 }}>
              <table className="table-compact">
                <thead><tr><th>Conferência</th><th className="num">Saldo no SCI</th><th className="num">Depois dos pagamentos</th><th className="num">Extrato</th><th>Situação</th></tr></thead>
                <tbody>
                  <tr>
                    <td>Banco {f.banco}{f.nomeDoBanco && ' · ' + f.nomeDoBanco}</td>
                    <td className="num">{f.saldoDoBanco != null ? comSinal(f.saldoDoBanco) : '—'}</td>
                    <td className="num">{f.bancoDepois != null ? comSinal(f.bancoDepois) : '—'}</td>
                    <td className="num">{f.extrato?.saldoFinal != null ? comSinal(f.extrato.saldoFinal) + ' em ' + dataTexto(f.extrato.ultimaData) : '—'}</td>
                    <td>{f.diferencaNoBanco == null ? <span className="badge badge-neutral">sem como conferir</span>
                      : !f.diferencaNoBanco ? <span className="badge badge-ok">bate com o extrato</span>
                        : <span className="badge badge-bad">diferença de {comSinal(f.diferencaNoBanco)}</span>}</td>
                  </tr>
                  <tr>
                    <td>Caixa {f.caixa}{f.nomeDoCaixa && ' · ' + f.nomeDoCaixa}</td>
                    <td className="num">{f.saldoDoCaixa != null ? comSinal(f.saldoDoCaixa) : '—'}</td>
                    <td className="num">{f.caixaDepois != null ? comSinal(f.caixaDepois) : '—'}</td>
                    <td className="num">—</td>
                    <td>{f.caixaDepois == null ? <span className="badge badge-neutral">—</span> : f.caixaDepois < 0 ? <span className="badge badge-bad">caixa negativo</span> : <span className="badge badge-ok">positivo</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {x && (x.pagamentos.length > 0 || x.abertas.length > 0) && (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table-compact">
                <thead><tr><th>Pagar</th><th>Conta</th><th>Pelo</th><th>Contrapartida</th><th>Data</th><th className="num">Valor</th><th className="num">Multa e juros</th><th>Complemento</th></tr></thead>
                <tbody>
                  {[...x.pagamentos, ...x.abertas].sort((a, z) => a.conta.codigo.localeCompare(z.conta.codigo) || a.provisao.data.localeCompare(z.provisao.data)).map(p => {
                    const aberta = x.abertas.includes(p);
                    return (
                      <tr key={p.chave} className={aberta ? 'bal-participante' : undefined}>
                        <td><input type="checkbox" checked={!aberta} disabled={!f.caixaLigado && p.pelo === 'caixa' && !f.deixada(p.chave)} onChange={() => f.alternar(p.chave)}
                          title={aberta ? 'Fica em aberto: marque para pagar' : 'Desmarque para deixar em aberto'} aria-label="Pagar" /></td>
                        <td>{p.conta.codigo} · {p.conta.nome}</td>
                        <td>{aberta ? <span className="badge badge-neutral">em aberto</span> : pelo(p.pelo)}</td>
                        <td>
                          {/* a contrapartida: o banco ou o caixa do sistema, ou a que a pessoa escolheu no plano */}
                          <button type="button" className="btn btn-ghost btn-sm" disabled={aberta} onClick={() => setBusca({ tipo: 'troca', chave: p.chave })} title="Trocar a conta, buscando no plano">
                            {contaNaTabela(p.provisao.credito === p.conta.codigo ? p.lancamento.credito : p.lancamento.debito)}<Icone nome="search" width={12} height={12} />
                          </button>
                          {f.trocada(p.chave) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => f.trocar(p.chave, '')} title="Voltar à conta do sistema">desfazer</button>}
                        </td>
                        <td>{dataTexto(p.lancamento.data)}</td>
                        <td className="num">{valorTexto(p.lancamento.valor)}</td>
                        <td className="num">{p.acrescimo ? valorTexto(p.acrescimo.valor) : ''}</td>
                        <td>{p.lancamento.complemento}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {x && (x.extratoSemProvisao.length > 0 || x.doExtrato.length > 0) && (
            <>
              <p className="hint" style={{ margin: '12px 0 6px' }}>
                {x.extratoSemProvisao.length ? (x.extratoSemProvisao.length === 1 ? '1 linha do extrato não pagou nenhuma provisão' : x.extratoSemProvisao.length + ' linhas do extrato não pagaram nenhuma provisão') + ': escolha a conta no plano e ela entra na planilha.' : 'As linhas do extrato sem provisão já têm conta.'}
              </p>
              <div className="table-wrap">
                <table className="table-compact">
                  <thead><tr><th>Data</th><th>Histórico do banco</th><th className="num">Valor</th><th>Conta</th></tr></thead>
                  <tbody>
                    {x.extratoSemProvisao.map(e => (
                      <tr key={e.chave}>
                        <td>{dataTexto(e.data)}</td><td>{e.historico}</td><td className="num">{comSinal(e.valor)}</td>
                        <td><button type="button" className="btn btn-outline btn-sm" onClick={() => setBusca({ tipo: 'extrato', chave: e.chave })}><Icone nome="search" width={12} height={12} />Escolher no plano</button></td>
                      </tr>
                    ))}
                    {x.doExtrato.map(e => {
                      const conta = e.linha.valor < 0 ? e.lancamento.debito : e.lancamento.credito;
                      return (
                        <tr key={e.chave}>
                          <td>{dataTexto(e.linha.data)}</td><td>{e.linha.historico}</td><td className="num">{comSinal(e.linha.valor)}</td>
                          <td>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBusca({ tipo: 'extrato', chave: e.chave })} title="Trocar a conta, buscando no plano">{contaNaTabela(conta)}<Icone nome="search" width={12} height={12} /></button>
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => f.lancarLinha(e.chave, '')} title="Tirar a conta: a linha não entra na planilha">desfazer</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * A conta aberta no balancete (27/11/2026, o Vitor: "o relatorio de todos os lancamentos de cada conta em um dropdown ... ver as
 * provisoes ... quais meses tao com pagamento e quais estao sem ... com um botao ele ja gerar os lancamentos e pagar sem esforco").
 */
export function ContaAberta({ vm, b, conta }: { vm: VmShadersCi; b: sci.BalanceteSci; conta: sci.ContaDoBalanceteSci }) {
  const c = useContaDoBalancete(vm, b, conta);
  if (c.semLancamentos) return <p className="hint" style={{ margin: 0 }}>Traga os lançamentos do SCI na <b>Importação</b> (o botão Vitor, "Tudo") para ver aqui os lançamentos e as provisões desta conta.</p>;
  const p = c.provisoes;
  return (
    <div className="bal-conta">
      {p && (
        <>
          <h4>Provisões por mês <span className="hint">{p.lado === 'credito' ? 'a provisão é o crédito; o pagamento, o débito' : 'a provisão é o débito; o recebimento, o crédito'}</span></h4>
          {p.meses.length ? (
            <table className="table-compact">
              <thead><tr><th>Mês</th><th className="num">Provisionado</th><th className="num">Pago</th><th className="num">Em aberto</th><th>Situação</th></tr></thead>
              <tbody>
                {p.meses.map(m => (
                  <tr key={m.mes}>
                    <td>{mesCurto(m.mes)}</td>
                    <td className="num">{valorTexto(m.provisionado)}</td>
                    <td className="num">{valorTexto(m.pago)}</td>
                    <td className="num">{valorTexto(m.aberto)}</td>
                    <td><span className={SITUACAO[m.situacao][0]}>{SITUACAO[m.situacao][1]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="hint">Nenhuma provisão nos lançamentos puxados.</p>}
          {p.aberto > 0 && (
            <>
              <div className="bal-campos">
                <Campo rotulo="Caixa" valor={c.caixa} mudar={c.setCaixa} dica={c.nomeDoCaixa} placeholder="código" />
                <Campo rotulo="Banco" valor={c.banco} mudar={c.setBanco} dica={c.nomeDoBanco || (c.extrato ? '' : 'sem extrato')} placeholder="código" />
                {p.lado === 'credito' && <Campo rotulo="Multa e juros" valor={c.juros} mudar={c.setJuros} dica={c.nomeDosJuros} placeholder="código" />}
                <Campo rotulo="Histórico" valor={c.historico} mudar={c.setHistorico} placeholder="nº no SCI" numero dica={p.lado === 'credito' ? '813 Pagamento de título nº' : '478 Recebimento de clientes cfe NF nº'} />
                <button type="button" className="btn btn-primary" disabled={c.gerando || !c.previa.length} onClick={c.gerar}>
                  <Icone nome="download" />{c.gerando ? 'Gerando…' : 'Pagar esta conta (' + c.previa.length + ')'}
                </button>
              </div>
              {c.previa.length > 0 && (
                <table className="table-compact">
                  <thead><tr><th>Pelo</th><th>Data</th><th className="num">Valor</th><th className="num">Multa e juros</th><th>Débito × Crédito</th><th>Complemento</th></tr></thead>
                  <tbody>
                    {c.previa.map((x, i) => (
                      <tr key={i}><td>{pelo(x.pelo)}</td><td>{dataTexto(x.lancamento.data)}</td><td className="num">{valorTexto(x.lancamento.valor)}</td><td className="num">{x.acrescimo ? valorTexto(x.acrescimo.valor) : ''}</td><td>{x.lancamento.debito} × {x.lancamento.credito}</td><td>{x.lancamento.complemento}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </>
      )}
      <h4>Lançamentos da conta <span className="hint">{c.lancamentos.length === 1 ? '1 lançamento' : c.lancamentos.length + ' lançamentos'} do SCI</span></h4>
      <RazaoDaConta conta={conta} lancamentos={c.lancamentos} nomeDa={c.nomeDa} />
    </div>
  );
}

/**
 * Os lançamentos da conta como um razão (27/11/2026, o Vitor: "Voce tá entendendo algo aqui, nem eu. melhora isso"): a data, o
 * histórico inteiro, a contrapartida pelo nome (o código apagado), o débito em azul, o crédito em vermelho e o saldo correndo, com o
 * mês numa faixa. A partida da folha vem do SCI em duas linhas, cada uma com um lado só: o core junta e põe a do outro lado em
 * `contrapartida`.
 */
function RazaoDaConta({ conta, lancamentos, nomeDa }: { conta: sci.ContaDoBalanceteSci; lancamentos: readonly sci.LancamentoDaConsulta[]; nomeDa: (codigo: string) => string }) {
  const ordenados = [...lancamentos].sort((x, y) => x.data.localeCompare(y.data));
  const contraDa = (l: sci.LancamentoDaConsulta, debito: boolean) => (debito ? l.credito : l.debito) || l.contrapartida || '';
  let saldo = conta.anterior;
  let mes = '';
  return (
    <table className="table-compact bal-razao">
      <thead><tr><th>Data</th><th>Histórico</th><th>Contrapartida</th><th className="num">Débito</th><th className="num">Crédito</th><th className="num">Saldo</th></tr></thead>
      <tbody>
        {conta.anterior !== 0 && <tr className="bal-razao-mes"><td colSpan={5}>Saldo anterior</td><td className="num"><span className={conta.anterior > 0 ? 'bm-d' : 'bm-c'}>{valorTexto(Math.abs(conta.anterior))}</span></td></tr>}
        {ordenados.slice(0, 500).map((l, i) => {
          const debito = l.debito === conta.codigo;
          saldo += debito ? l.valor : -l.valor;
          const contra = contraDa(l, debito);
          const nome = contra ? nomeDa(contra) : '';
          const novoMes = l.data.slice(0, 7) !== mes;
          mes = l.data.slice(0, 7);
          return (
            <Fragment key={i}>
              {novoMes && <tr className="bal-razao-mes"><td colSpan={6}>{mesCurto(l.data.slice(0, 7))}</td></tr>}
              <tr>
                <td className="bal-razao-data">{dataTexto(l.data).slice(0, 5)}</td>
                <td className="bal-razao-hist">{l.complemento || l.historico || <span className="hint">sem histórico</span>}</td>
                <td className="bal-razao-contra">{contra ? <>{nome || 'Conta ' + contra}{nome && <small> {contra}</small>}</> : <span className="hint">—</span>}</td>
                <td className="num bm-d">{debito ? valorTexto(l.valor) : ''}</td>
                <td className="num bm-c">{debito ? '' : valorTexto(l.valor)}</td>
                <td className="num"><span className={saldo > 0 ? 'bm-d' : saldo < 0 ? 'bm-c' : 'bm-zero'}>{saldo ? valorTexto(Math.abs(saldo)) : '—'}</span></td>
              </tr>
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
