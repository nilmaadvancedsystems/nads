// O Balancete da Contabilização, mês a mês (27/11/2026). Refeito com o Vitor: "Deixa isso clean cara"; "nao preciso da classificação
// das contas"; "devedor tem que ficar azul e credor vermelho"; "apresenta outra maneira de apresentar o nome e as contas"; "nesse
// balancete eu so quero as analiticas, com dropdown de coisas em aberto"; "da um jeito de aproveitar a tela".
//   - só as analíticas, agrupadas pelo grupo de cima (Ativo, Passivo, Receitas, Despesas), numa faixa fina;
//   - a conta: o nome em cima e, embaixo, apagado, o código reduzido e a conta-mãe (a de participantes leva o nome da mãe);
//   - o saldo pela cor (devedor azul, credor vermelho), sem o D/C escrito; o movimento com o débito em azul e o crédito em vermelho;
//   - a conta fixa à esquerda e os meses ocupando o resto; o em aberto numa coluna e a seta abre a conta (as provisões, o pagar);
//   - a conferência com o SCI num ícone no fim da linha; o cabeçalho numa linha só.
// Só desenha: as contas e os meses vêm do core (sci.balanceteMesAMes) e a conta aberta do ContaAberta.
import { sci } from '@nads/core';
import { Icone, Segmentado, Vazio } from '@nads/ui';
import { Fragment, useMemo, useState } from 'react';
import { ContaAberta } from './BalanceteDoSci';
import type { VmShadersCi } from './useShadersCi';

type Visao = 'saldos' | 'movimento';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const dataTexto = (iso: string) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const valor = (v: number) => sci.valorParaTexto(Math.abs(v));
const nomeBonito = (n: string) => (n === n.toUpperCase() ? n.charAt(0) + n.slice(1).toLowerCase() : n);

/** O saldo pela cor: devedor azul, credor vermelho; zero fica um traço apagado. */
function Saldo({ v, forte }: { v: number; forte?: boolean }) {
  if (!v) return <span className="bm-zero">—</span>;
  const s = <span className={v > 0 ? 'bm-d' : 'bm-c'} title={v > 0 ? 'Devedor' : 'Credor'}>{valor(v)}</span>;
  return forte ? <b>{s}</b> : s;
}

export function BalanceteMesAMes({ vm, b, calculado, todos }: { vm: VmShadersCi; b: sci.BalanceteSci | null; calculado: sci.BalanceteCalculado | null; todos: readonly sci.LancamentoDaConsulta[] }) {
  const [visao, setVisao] = useState<Visao>('saldos');
  const [soDivergentes, setSoDivergentes] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [celula, setCelula] = useState<{ classificacao: string; mes: string } | null>(null);
  const mm = useMemo(() => (b && todos.length ? sci.balanceteMesAMes(b, todos) : null), [b, todos]);
  // os lançamentos com o código do balancete (o banco que vem com outro código na consulta) e as partidas da folha juntas
  const doBalancete = useMemo(() => (b ? sci.consultaNoBalancete(b, todos) : []), [b, todos]);

  // os nomes pela classificação: o grupo de cima e a conta-mãe de cada analítica
  const nomes = useMemo(() => new Map((mm?.linhas || []).map(c => [c.classificacao, c.nome])), [mm]);
  // o reduzido → a classificação (a analítica; o participante repete o reduzido da mãe)
  const classificacaoDo = useMemo(() => new Map((mm?.linhas || []).filter(c => c.analitica && !c.participante).map(c => [c.codigo, c.classificacao])), [mm]);
  if (!b || !calculado || !mm) {
    return <section className="card"><Vazio icone="scale" titulo="Faltam arquivos" texto="Na Importação, traga os lançamentos e o balancete do SCI: o balancete mês a mês usa o saldo anterior e o período dele." /></section>;
  }
  const mae = (c: sci.ContaDoBalanceteSci) => {
    const p = c.classificacao.split('.');
    for (let n = p.length - 1; n >= 1; n--) { const m = nomes.get(p.slice(0, n).join('.')); if (m) return m; }
    return '';
  };
  const analiticas = mm.linhas.filter(c => c.analitica && !c.participante);
  const linhas = analiticas.filter(c => !soDivergentes || !c.confere);
  const divergentes = analiticas.filter(c => !c.confere).length;
  const abertoDa = (c: sci.LinhaMesAMes) => c.meses.reduce((t, m) => t + (m.aberto || 0), 0);
  const temAberto = analiticas.some(c => abertoDa(c) > 0);
  const umAno = mm.meses.every(m => m.slice(0, 4) === mm.meses[0]?.slice(0, 4));
  const mesCurto = (m: string) => MESES[Number(m.slice(5, 7)) - 1] + (umAno ? '' : '/' + m.slice(2, 4));
  const colunas = 3 + mm.meses.length + (temAberto ? 1 : 0) + 1;
  const lancamentosDaCelula = (c: sci.LinhaMesAMes, mes: string) => doBalancete.filter(l => l.data.startsWith(mes) && (l.debito === c.codigo || l.credito === c.codigo)).sort((x, y) => x.data.localeCompare(y.data));
  let grupo = '';

  return (
    <section className="card bm">
      <div className="bm-head">
        <h3>Balancete</h3>
        <span className="bm-periodo">{dataTexto(calculado.inicio)} a {dataTexto(calculado.fim)}</span>
        {divergentes
          ? <button type="button" className={'btn btn-sm bm-sci' + (soDivergentes ? ' btn-primary' : ' btn-outline')} aria-pressed={soDivergentes} onClick={() => setSoDivergentes(s => !s)}
              title={soDivergentes ? 'Mostrar todas as contas' : 'Mostrar só as que não batem com o SCI'}>
              <Icone nome="alert" />{divergentes === 1 ? '1 conta diferente do SCI' : divergentes + ' contas diferentes do SCI'}
            </button>
          : <span className="bm-ok"><Icone nome="check" />Igual ao SCI</span>}
        <span className="bm-legenda"><i className="bm-d">●</i> devedor <i className="bm-c">●</i> credor</span>
        <Segmentado<Visao> valor={visao} onMudar={v => { setVisao(v); setCelula(null); }} opcoes={[{ valor: 'saldos', rotulo: 'Saldos' }, { valor: 'movimento', rotulo: 'Movimento' }]} />
      </div>
      <div className="table-wrap bm-grade">
        <table className="table-compact">
          <thead>
            <tr>
              <th className="bm-conta">Conta</th>
              <th className="num">Anterior</th>
              {mm.meses.map(m => <th key={m} className="num">{mesCurto(m)}</th>)}
              <th className="num">Atual</th>
              {temAberto && <th className="num">Em aberto</th>}
              <th className="bm-st" aria-label="Com o SCI" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((c, k) => {
              const g = c.classificacao.split('.')[0];
              const novoGrupo = g !== grupo;
              grupo = g;
              const estaAberta = aberta === c.classificacao;
              const sel = celula && celula.classificacao === c.classificacao ? celula.mes : null;
              const aberto = abertoDa(c);
              const nome = c.nome;
              const contexto = mae(c);
              return (
                <Fragment key={c.classificacao + '|' + k}>
                  {novoGrupo && <tr className="bm-grupo"><td colSpan={colunas}>{nomes.get(g) || g}</td></tr>}
                  <tr className={estaAberta ? 'bm-aberta' : undefined}>
                    <td className="bm-conta">
                      <button type="button" className="bm-abre" onClick={() => setAberta(a => (a === c.classificacao ? null : c.classificacao))} aria-expanded={estaAberta}
                        title={estaAberta ? 'Fechar a conta' : 'Abrir a conta: os lançamentos, o que está em aberto e o pagar'}>
                        <Icone nome={estaAberta ? 'chevronDown' : 'chevronRight'} />
                        <span className="bm-nome">
                          <span>{nomeBonito(nome)}</span>
                          <small>{c.codigo}{contexto ? ' · ' + nomeBonito(contexto) : ''}</small>
                        </span>
                      </button>
                    </td>
                    <td className="num">{visao === 'saldos' ? <Saldo v={c.anterior} /> : ''}</td>
                    {c.meses.map(m => {
                      const vazio = !m.lancamentos;
                      return (
                        <td key={m.mes} className={'num bm-mes' + (vazio ? '' : ' clica') + (sel === m.mes ? ' sel' : '')}
                          onClick={vazio ? undefined : () => setCelula(x => (x && x.classificacao === c.classificacao && x.mes === m.mes ? null : { classificacao: c.classificacao, mes: m.mes }))}
                          title={vazio ? undefined : m.lancamentos + (m.lancamentos === 1 ? ' lançamento' : ' lançamentos') + ': clique para ver'}>
                          {visao === 'saldos' ? (vazio && !m.saldo ? <span className="bm-zero">—</span> : <Saldo v={m.saldo} />)
                            : vazio ? <span className="bm-zero">—</span>
                              : <>{m.debito ? <span className="bm-d bm-linha">{valor(m.debito)}</span> : null}{m.credito ? <span className="bm-c bm-linha">{valor(m.credito)}</span> : null}</>}
                        </td>
                      );
                    })}
                    <td className="num bm-atual"><Saldo v={c.atual} forte /></td>
                    {temAberto && <td className="num">{aberto ? <span className="bm-aberto">{valor(aberto)}</span> : ''}</td>}
                    <td className="bm-st">
                      {c.confere
                        ? <span className="bm-st-ok" title="Igual ao SCI"><Icone nome="check" /></span>
                        : <span className="bm-st-mal" title={'No SCI: débito ' + valor(c.doSci.debito) + ' · crédito ' + valor(c.doSci.credito) + ' · saldo ' + valor(c.doSci.atual) + (c.doSci.atual > 0 ? ' D' : c.doSci.atual < 0 ? ' C' : '')}><Icone nome="alert" /></span>}
                    </td>
                  </tr>
                  {sel && (
                    <tr className="bal-painel">
                      <td colSpan={colunas}>
                        <div className="bal-conta">
                          <h4>{nomeBonito(nome)} em {MESES[Number(sel.slice(5, 7)) - 1]}/{sel.slice(0, 4)}</h4>
                          <table className="table-compact">
                            <thead><tr><th>Data</th><th className="num">Débito</th><th className="num">Crédito</th><th>Contrapartida</th><th>Histórico</th><th>Lote</th></tr></thead>
                            <tbody>
                              {lancamentosDaCelula(c, sel).map((l, n) => {
                                const debito = l.debito === c.codigo;
                                const contra = (debito ? l.credito : l.debito) || l.contrapartida || '';
                                return <tr key={n}><td>{dataTexto(l.data)}</td><td className="num bm-d">{debito ? valor(l.valor) : ''}</td><td className="num bm-c">{debito ? '' : valor(l.valor)}</td><td>{contra ? nomeBonito(nomes.get(classificacaoDo.get(contra) || '') || 'Conta ' + contra) : '—'}{contra && classificacaoDo.has(contra) && <small className="bm-cod"> {contra}</small>}</td><td>{l.complemento}</td><td>{l.lote}</td></tr>;
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
            {!linhas.length && <tr><td colSpan={colunas} className="hint" style={{ padding: 16 }}>Nenhuma conta analítica com movimento.</td></tr>}
          </tbody>
        </table>
      </div>
      {calculado.foraDoBalancete.length > 0 && (
        <details className="bm-fora">
          <summary>{calculado.foraDoBalancete.length === 1 ? '1 conta com lançamento' : calculado.foraDoBalancete.length + ' contas com lançamento'} que o balancete do SCI não tem</summary>
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Conta</th><th className="num">Lançamentos</th><th className="num">Débito</th><th className="num">Crédito</th></tr></thead>
              <tbody>{calculado.foraDoBalancete.map(f => <tr key={f.codigo}><td>{f.codigo}</td><td className="num">{f.lancamentos}</td><td className="num bm-d">{f.debito ? valor(f.debito) : ''}</td><td className="num bm-c">{f.credito ? valor(f.credito) : ''}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
