// A Contabilização do minimum no desenho da tarefa (27/11/2026, o Vitor: "quero uma etapa de importacao igual ao tarefas que tinhamos
// la, tudo por menu lateral. Dentro de importacao vai ter: Lancamentos, Balancete e extratos"; "Na etapa de importacao eu nao edito
// nada, so visualizo"; "Depois quero uma apresentacao do balancete, em outra etapa, que voce mesmo vai montar ... vire um segundo
// sistema contabil"). As etapas no menu lateral da tarefa (a caixinha verde quando está feita):
//   1. Importação: os arquivos, só para ver (cada um pelo robô do PC ou do computador; o extrato também pelo Drive e pelo e-mail);
//   2. Balancete: o calculado pelo nads (os lançamentos somados com o saldo anterior do SCI), conferido com o do SCI;
//   3. Fechamento: os pagamentos, o banco conferido com o extrato e a planilha.
// Só desenha: o que entra e o que se calcula vem dos ganchos e do core.
import { sci } from '@nads/core';
import { Icone, LogoSci, Segmentado, SeletorMes, Vazio } from '@nads/ui';
import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react';
import { AcoesDoTopo } from '../../../../comum/topo';
import { JanelaBuscarNoEmail } from '../../etapas/extrator/telas/tarefa/JanelaBuscarNoEmail';
import { ContaAberta, FechamentoDoPeriodo } from './BalanceteDoSci';
import { PuxarDoSci, SituacaoDoRobo } from './RazaoDoSci';
import { useImportacaoDaContabilizacao, type ImportacaoDaContabilizacao } from './useImportacaoDaContabilizacao';
import type { RoboDoSci } from './useLancamentosDoSciPeloRobo';
import type { VmShadersCi } from './useShadersCi';

type Etapa = 'importacao' | 'balancete' | 'fechamento';
const CHAVE_DA_ETAPA = 'nads-minimum-contabilizacao-etapa';
const dataTexto = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const saldoTexto = (v: number) => (v ? sci.valorParaTexto(Math.abs(v)) + (v > 0 ? ' D' : ' C') : '—');
const valorTexto = (v: number) => (v ? sci.valorParaTexto(v) : '—');
const comSinal = (v: number) => (v < 0 ? '−' : '') + sci.valorParaTexto(Math.abs(v));

export function ContabilizacaoDoSci({ vm }: { vm: VmShadersCi }) {
  const imp = useImportacaoDaContabilizacao(vm);
  const [etapa, setEtapa] = useState<Etapa>(() => {
    try { const e = localStorage.getItem(CHAVE_DA_ETAPA); return e === 'balancete' || e === 'fechamento' ? e : 'importacao'; } catch { return 'importacao'; }
  });
  const ir = (e: Etapa) => { setEtapa(e); try { localStorage.setItem(CHAVE_DA_ETAPA, e); } catch { /* sem armazenamento */ } window.scrollTo({ top: 0 }); };
  const b = imp.balancete?.balancete || null;
  const calculado = useMemo(() => (b && imp.consulta ? sci.balanceteCalculado(b, imp.consulta.lancamentos) : null), [b, imp.consulta]);
  const etapas: { id: Etapa; rotulo: string; feita: boolean }[] = [
    { id: 'importacao', rotulo: 'Importação', feita: imp.feita },
    { id: 'balancete', rotulo: 'Balancete', feita: !!calculado && !calculado.divergentes },
    { id: 'fechamento', rotulo: 'Fechamento', feita: false },
  ];
  const i = etapas.findIndex(e => e.id === etapa);
  return (
    <>
      <AcoesDoTopo>
        <button type="button" className="btn btn-outline sci-btn-icone" onClick={() => vm.abrirApp(null)} title="Voltar aos apps" aria-label="Voltar aos apps"><Icone nome="chevronLeft" /></button>
      </AcoesDoTopo>
      <div className="contab-layout">
        {/* o menu lateral da tarefa (o mesmo .subnav, com a caixinha de cada etapa) */}
        <nav className="subnav contab-subnav" aria-label="Etapas da Contabilização">
          <p className="subnav-titulo">Etapas</p>
          <div className="subnav-itens">
            {etapas.map(e => (
              <button key={e.id} type="button" className={'subnav-item' + (e.id === etapa ? ' active' : '')} onClick={() => ir(e.id)} aria-current={e.id === etapa ? 'page' : undefined}>
                <span className={'subnav-caixa ' + (e.feita ? 'marcada' : 'vazia')}>{e.feita && <Icone nome="check" />}</span>
                <span>{e.rotulo}</span>
              </button>
            ))}
          </div>
        </nav>
        <div className="contab-etapa">
          {etapa === 'importacao' ? <Importacao imp={imp} /> : etapa === 'balancete' ? <BalanceteCalculado vm={vm} b={b} calculado={calculado} todos={imp.consulta?.lancamentos || []} /> : <FechamentoDoPeriodo vm={vm} />}
          {etapas[i + 1] && (
            <div className="sci-contab-proximo">
              <button type="button" className="btn btn-primary" onClick={() => ir(etapas[i + 1].id)}>Próximo: {etapas[i + 1].rotulo}<Icone nome="chevronRight" /></button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------- 1. a Importação
/** Uma linha da importação, no desenho da tarefa: a seta, o ícone, o nome, o resumo e as ações; aberta, o que veio. */
function Linha({ icone, nome, conta, resumo, feito, acoes, robo, children }: {
  icone: ReactNode; nome: string; conta?: string; resumo: ReactNode; feito: boolean; acoes: ReactNode; robo?: RoboDoSci; children?: ReactNode;
}) {
  const [aberta, setAberta] = useState(false);
  return (
    <div className="imp-bloco">
      <div className="imp-linha">
        <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} disabled={!children} onClick={() => setAberta(a => !a)} aria-expanded={aberta} title={aberta ? 'Fechar' : 'Ver o que veio'}><Icone nome="chevronDown" /></button>
        <span className="imp-ico">{icone}</span>
        <div className="imp-txt"><b>{nome}{conta && <span className="imp-conta hint"> · {conta}</span>}</b><div className="imp-resumo"><div>{resumo}</div></div></div>
        <div className="imp-grupos">
          {feito ? <span className="badge badge-ok">Ok</span> : <span className="badge badge-neutral">Falta</span>}
          {acoes}
        </div>
      </div>
      {robo && (robo.andando || robo.lendo || robo.erro) && <div className="contab-robo"><SituacaoDoRobo robo={robo} /></div>}
      {aberta && children && <div className="contab-detalhe">{children}</div>}
    </div>
  );
}

function BotaoDoComputador({ titulo, aceitar, onArquivo }: { titulo: string; aceitar: string; onArquivo: (f: File | undefined) => void }) {
  const campo = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="icon-btn icon-btn-sm imp-btn" title={titulo} aria-label={titulo} onClick={() => campo.current?.click()}><Icone nome="upload" /></button>
      <input ref={campo} type="file" accept={aceitar} hidden onChange={e => { onArquivo(e.target.files?.[0]); e.target.value = ''; }} />
    </>
  );
}

function Importacao({ imp }: { imp: ImportacaoDaContabilizacao }) {
  const c = imp.consulta;
  const bg = imp.balancete;
  const ex = imp.resumoDoExtrato;
  const p = imp.puxarExtrato;
  return (
    <section className="card">
      <div className="card-head"><h3>Importação</h3><span className="hint">Os arquivos que vão ser comparados com os lançamentos. Aqui só se vê: o que se decide fica nas próximas etapas.</span></div>
      <div className="imp-lista">
        {/* os lançamentos do SCI */}
        <Linha icone={<LogoSci altura={14} />} nome="Lançamentos do SCI" feito={!!c?.lancamentos.length} robo={imp.roboDosLancamentos}
          resumo={c?.lancamentos.length ? <><span>{c.lancamentos.length.toLocaleString('pt-BR')} lançamentos · {imp.periodoDaConsulta}</span><span>{c.arquivo}</span></> : <span>Ainda não veio</span>}
          acoes={<>{imp.roboDosLancamentos.disponivel && <PuxarDoSci robo={imp.roboDosLancamentos} temLancamentos={!!c?.lancamentos.length} />}
            <BotaoDoComputador titulo="Importar a consulta do SCI do computador (.xls, .xlsx, .csv)" aceitar=".xls,.xlsx,.csv" onArquivo={f => { void imp.importarConsulta(f); }} /></>}>
          {c?.lancamentos.length ? (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Data</th><th>Débito</th><th>Crédito</th><th className="num">Valor</th><th>Histórico</th><th>Doc.</th><th>Lote</th></tr></thead>
                <tbody>
                  {c.lancamentos.slice(0, 500).map((l, k) => (
                    <tr key={k}><td>{dataTexto(l.data)}</td><td>{l.debito}</td><td>{l.credito}</td><td className="num">{valorTexto(l.valor)}</td><td>{[l.historico, l.complemento].filter(Boolean).join(' · ')}</td><td>{l.documento}</td><td>{l.lote}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : undefined}
        </Linha>

        {/* o balancete do SCI */}
        <Linha icone={<Icone nome="scale" />} nome="Balancete do SCI" feito={!!bg} robo={imp.roboDoBalancete}
          resumo={bg ? <><span>{dataTexto(bg.balancete.inicio)} a {dataTexto(bg.balancete.fim)} · {bg.balancete.contas.filter(x => !x.participante).length} contas</span><span>{bg.arquivo}</span></> : <span>Ainda não veio</span>}
          acoes={<>{imp.roboDoBalancete.disponivel && <PuxarDoSci robo={imp.roboDoBalancete} semTudo />}
            <BotaoDoComputador titulo="Importar o balancete do SCI do computador (.xls, .xlsx, .csv)" aceitar=".xls,.xlsx,.csv" onArquivo={f => { void imp.importarBalancete(f); }} /></>}>
          {bg ? (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Classificação</th><th>Conta</th><th>Nome</th><th className="num">Saldo anterior</th><th className="num">Débito</th><th className="num">Crédito</th><th className="num">Saldo atual</th></tr></thead>
                <tbody>
                  {bg.balancete.contas.map((x, k) => (
                    <tr key={k} className={x.analitica || x.participante ? (x.participante ? 'bal-participante' : '') : 'bal-sintetica'}>
                      <td className="bal-class">{x.classificacao}</td><td>{x.participante ? '' : x.codigo}</td><td>{x.nome}</td>
                      <td className="num">{saldoTexto(x.anterior)}</td><td className="num">{valorTexto(x.debito)}</td><td className="num">{valorTexto(x.credito)}</td><td className="num">{saldoTexto(x.atual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : undefined}
        </Linha>

        {/* o extrato */}
        <Linha icone={<Icone nome="landmark" />} nome="Extrato" conta={p.banco ? p.banco.nome + (p.banco.conta ? ' · c/c ' + p.banco.conta : '') : undefined} feito={!!ex}
          resumo={ex ? <><span>{ex.linhas.length} linhas{ex.saldoFinal != null ? ' · saldo final ' + comSinal(ex.saldoFinal) : ''}{ex.ultimaData ? ' em ' + dataTexto(ex.ultimaData) : ''}</span><span>{ex.arquivo}</span></> : <span>{p.lendo || 'Ainda não veio'}</span>}
          acoes={ex ? <button type="button" className="btn btn-outline btn-sm" onClick={imp.trocarExtrato}>Trocar</button> : (
            <>
              {p.bancos.length > 1 && (
                <select className="input" style={{ width: 'auto' }} value={p.banco?.id || ''} onChange={e => p.setBanco(e.target.value)} aria-label="O banco">
                  {p.bancos.map(x => <option key={x.id} value={x.id}>{x.nome}{x.conta ? ' · c/c ' + x.conta : ''}</option>)}
                </select>
              )}
              <SeletorMes valor={p.mes} onMudar={m => p.setMes(m)} rotulo="O mês do extrato" />
              {p.precisaEntrar
                ? <button type="button" className="btn btn-outline btn-sm" onClick={p.entrar}><Icone nome="lock" />Entrar no Drive</button>
                : <button type="button" className="btn btn-outline btn-sm" onClick={p.buscarNoDrive} disabled={!!p.lendo}><Icone nome="pasta" />Drive</button>}
              {p.temEmail && <button type="button" className="btn btn-outline btn-sm" onClick={p.abrirEmail} disabled={!!p.lendo}><Icone nome="envelope" />E-mail</button>}
              <BotaoDoComputador titulo="Importar o extrato do computador (PDF, OFX, planilha ou foto)" aceitar=".pdf,.ofx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png" onArquivo={f => { void imp.importarExtrato(f); }} />
            </>
          )}>
          {ex ? (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Data</th><th>Histórico do banco</th><th className="num">Valor</th></tr></thead>
                <tbody>{ex.linhas.map((l, k) => <tr key={k}><td>{dataTexto(l.data)}</td><td>{l.historico}</td><td className="num">{comSinal(l.valor)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : undefined}
        </Linha>
        {!ex && p.erro && !p.lendo && <p className="hint" style={{ color: 'var(--danger)', margin: 0 }}>{p.erro}</p>}
        {!ex && (p.candidatos.length > 0 || p.recebidos.length > 0) && (
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>De onde</th><th>Arquivo</th><th /></tr></thead>
              <tbody>
                {p.candidatos.slice(0, 8).map(a => <tr key={'d' + a.id}><td>Drive</td><td>{a.caminho || a.nome}</td><td style={{ textAlign: 'right' }}><button type="button" className="btn btn-outline btn-sm" onClick={() => p.usarDoDrive(a)}>Usar</button></td></tr>)}
                {p.recebidos.map(r => <tr key={'r' + r.id}><td>Recebido pelo robô</td><td>{r.nome}</td><td style={{ textAlign: 'right' }}><button type="button" className="btn btn-outline btn-sm" onClick={() => p.usarRecebido(r)} disabled={!!p.lendo}>Usar</button></td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <JanelaBuscarNoEmail vm={p.email} />
    </section>
  );
}

// ------------------------------------------------------------------------------------------------- 2. o Balancete mês a mês
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const mesCurto = (m: string) => MESES_CURTOS[Number(m.slice(5, 7)) - 1] + '/' + m.slice(2, 4);
type Visao = 'saldos' | 'movimento' | 'aberto';

/**
 * O balancete calculado pelo nads, mês a mês (27/11/2026, o Vitor: "vire um segundo sistema contabil ... pegando o saldo anterior do
 * balancete, que fique exatamente como o balancete da empresa"; "na segunda tela vai apresentar o que esta em aberto e os saldos, mes a
 * mes de cada conta do balancete, de maneira dinamica"): cada conta numa linha, cada mês numa coluna, com a visão dos saldos, do
 * movimento ou do que está em aberto; a célula abre os lançamentos daquele mês; a classificação abre a conta (os lançamentos, as
 * provisões e o pagar); a última coluna confere com o SCI.
 */
function BalanceteCalculado({ vm, b, calculado, todos }: { vm: VmShadersCi; b: sci.BalanceteSci | null; calculado: sci.BalanceteCalculado | null; todos: readonly sci.LancamentoDaConsulta[] }) {
  const [visao, setVisao] = useState<Visao>('saldos');
  const [soAnaliticas, setSoAnaliticas] = useState(false);
  const [soDivergentes, setSoDivergentes] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [celula, setCelula] = useState<{ classificacao: string; mes: string } | null>(null);
  const mm = useMemo(() => (b && todos.length ? sci.balanceteMesAMes(b, todos) : null), [b, todos]);
  if (!b || !calculado || !mm) {
    return <section className="card"><Vazio icone="scale" titulo="Faltam arquivos" texto="Na Importação, traga os lançamentos e o balancete do SCI: o balancete mês a mês usa o saldo anterior e o período dele." /></section>;
  }
  const linhas = mm.linhas.filter(c => (!soAnaliticas || c.analitica) && (!soDivergentes || !c.confere) && (visao !== 'aberto' || c.meses.some(m => m.aberto != null)));
  const recuo = (c: sci.ContaDoBalanceteSci) => Math.max(0, (c.nivel ?? c.classificacao.split('.').length) - 1);
  const totalAberto = mm.linhas.filter(c => c.analitica && !c.participante).reduce((t, c) => t + c.meses.reduce((u, m) => u + (m.aberto || 0), 0), 0);
  const colunas = 5 + mm.meses.length;
  const lancamentosDaCelula = (c: sci.LinhaMesAMes, mes: string) => todos.filter(l => l.data.startsWith(mes) && (l.debito === c.codigo || l.credito === c.codigo)).sort((x, y) => x.data.localeCompare(y.data));
  return (
    <section className="card">
      <div className="card-head">
        <h3>Balancete de {dataTexto(calculado.inicio)} a {dataTexto(calculado.fim)}</h3>
        {calculado.divergentes ? <span className="badge badge-bad">{calculado.divergentes === 1 ? '1 conta não bate com o SCI' : calculado.divergentes + ' contas não batem com o SCI'}</span> : <span className="badge badge-ok">igual ao do SCI</span>}
        {totalAberto > 0 && <span className="badge badge-warn">{sci.valorParaTexto(totalAberto)} em aberto</span>}
        <span style={{ flex: 1 }} />
        <label className="card-head-ctl"><input type="checkbox" checked={soAnaliticas} onChange={e => setSoAnaliticas(e.target.checked)} />Só as analíticas</label>
        <label className="card-head-ctl"><input type="checkbox" checked={soDivergentes} onChange={e => setSoDivergentes(e.target.checked)} />Só as que não batem</label>
        <Segmentado<Visao> valor={visao} onMudar={v => { setVisao(v); setCelula(null); }} opcoes={[{ valor: 'saldos', rotulo: 'Saldos' }, { valor: 'movimento', rotulo: 'Movimento' }, { valor: 'aberto', rotulo: 'Em aberto' }]} />
      </div>
      <p className="hint" style={{ margin: '0 0 8px' }}>Calculado pelo nads: o saldo anterior do SCI e os lançamentos somados conta a conta. Clique no mês para ver os lançamentos; na classificação, para abrir a conta.</p>
      <div className="table-wrap bal-tabela bal-meses">
        <table className="table-compact">
          <thead>
            <tr>
              <th>Classificação</th><th>Nome</th><th className="num">Saldo anterior</th>
              {mm.meses.map(m => <th key={m} className="num">{mesCurto(m)}</th>)}
              <th className="num">{visao === 'aberto' ? 'Em aberto' : 'Saldo atual'}</th><th>SCI</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((c, k) => {
              const abre = c.analitica && !c.participante;
              const estaAberta = abre && aberta === c.classificacao;
              const sel = celula && celula.classificacao === c.classificacao ? celula.mes : null;
              const aberto = c.meses.reduce((t, m) => t + (m.aberto || 0), 0);
              return (
                <Fragment key={c.classificacao + '|' + k}>
                  <tr className={(c.analitica || c.participante ? '' : 'bal-sintetica') + (c.participante ? ' bal-participante' : '')}>
                    <td className={'bal-class' + (abre ? ' bal-abre' : '')} onClick={abre ? () => setAberta(a => (a === c.classificacao ? null : c.classificacao)) : undefined} title={abre ? 'Abrir a conta: os lançamentos, as provisões e o pagar' : undefined}>
                      {abre && <Icone nome={estaAberta ? 'chevronDown' : 'chevronRight'} width={14} height={14} />}{c.classificacao}
                    </td>
                    <td className="bal-nome"><span style={{ paddingLeft: recuo(c) * 12 }}>{c.participante ? c.nome : (c.codigo ? c.codigo + ' · ' : '') + c.nome}</span></td>
                    <td className="num">{visao === 'aberto' ? '' : saldoTexto(c.anterior)}</td>
                    {c.meses.map(m => {
                      const vazio = !m.lancamentos;
                      const clica = abre && !vazio;
                      return (
                        <td key={m.mes} className={'num bal-mes' + (vazio ? ' vazio' : '') + (clica ? ' clica' : '') + (sel === m.mes ? ' sel' : '')}
                          onClick={clica ? () => setCelula(x => (x && x.classificacao === c.classificacao && x.mes === m.mes ? null : { classificacao: c.classificacao, mes: m.mes })) : undefined}>
                          {visao === 'saldos' ? saldoTexto(m.saldo)
                            : visao === 'movimento' ? (vazio ? '' : <><span className="bal-d">{m.debito ? 'D ' + sci.valorParaTexto(m.debito) : ''}</span><span className="bal-c">{m.credito ? 'C ' + sci.valorParaTexto(m.credito) : ''}</span></>)
                              : m.aberto ? <span className="badge badge-bad">{sci.valorParaTexto(m.aberto)}</span> : ''}
                        </td>
                      );
                    })}
                    <td className="num">{visao === 'aberto' ? (aberto ? <b>{sci.valorParaTexto(aberto)}</b> : '') : <b>{saldoTexto(c.atual)}</b>}</td>
                    <td title={c.confere ? undefined : 'No SCI: débito ' + valorTexto(c.doSci.debito) + ' · crédito ' + valorTexto(c.doSci.credito) + ' · saldo ' + saldoTexto(c.doSci.atual)}>
                      {c.confere ? <span className="badge badge-ok">igual</span> : <span className="badge badge-bad">SCI {saldoTexto(c.doSci.atual)}</span>}
                    </td>
                  </tr>
                  {sel && (
                    <tr className="bal-painel">
                      <td colSpan={colunas}>
                        <div className="bal-conta">
                          <h4>{c.codigo} · {c.nome} em {mesCurto(sel)}</h4>
                          <table className="table-compact">
                            <thead><tr><th>Data</th><th className="num">Débito</th><th className="num">Crédito</th><th>Contrapartida</th><th>Histórico</th><th>Lote</th></tr></thead>
                            <tbody>
                              {lancamentosDaCelula(c, sel).map((l, n) => {
                                const debito = l.debito === c.codigo;
                                return <tr key={n}><td>{dataTexto(l.data)}</td><td className="num">{debito ? valorTexto(l.valor) : ''}</td><td className="num">{debito ? '' : valorTexto(l.valor)}</td><td>{(debito ? l.credito : l.debito) || '—'}</td><td>{l.complemento}</td><td>{l.lote}</td></tr>;
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  {estaAberta && <tr className="bal-painel"><td colSpan={colunas}><ContaAberta vm={vm} b={b} conta={c} /></td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {calculado.foraDoBalancete.length > 0 && (
        <>
          <p className="hint" style={{ margin: '12px 0 6px' }}>Lançamentos do período em contas que o balancete do SCI não tem:</p>
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Conta</th><th className="num">Lançamentos</th><th className="num">Débito</th><th className="num">Crédito</th></tr></thead>
              <tbody>{calculado.foraDoBalancete.map(f => <tr key={f.codigo}><td>{f.codigo}</td><td className="num">{f.lancamentos}</td><td className="num">{valorTexto(f.debito)}</td><td className="num">{valorTexto(f.credito)}</td></tr>)}</tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
