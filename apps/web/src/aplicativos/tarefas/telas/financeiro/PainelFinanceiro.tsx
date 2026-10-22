// Financeiro › Painel (22/10/2026: "no financeiro, faça um dashboard de entradas, saídas dentre outros"): o período e
// quatro números (entradas, saídas, resultado, saldo do caixa hoje); para onde foi e de onde veio o dinheiro, por conta do
// plano; os honorários do mês passado e as notas emitidas no período; e o mês a mês dos últimos 12 meses. Só as peças do
// catálogo (Segmentado, Stat, Cartão, Ranking, Tabela, Vazio).
import { formatos } from '@nads/core';
import { Segmentado, Stat, useCarregando, Vazio } from '@nads/ui';
import { usePainelFinanceiro } from './usePainelFinanceiro';

const reais = (v: number) => formatos.reais(v);

function PorConta({ titulo, itens, cor, vazio }: { titulo: string; itens: { rotulo: string; total: number; pct: number }[]; cor: string; vazio: string }) {
  return (
    <div className="card">
      <h3>{titulo}</h3>
      {itens.length ? (
        <div className="rank">
          {itens.map(x => (
            <div key={x.rotulo} className="rank-item">
              <span className="rank-nome">{x.rotulo}</span><span className="rank-val num">{reais(x.total)} <span className="fraco">{x.pct.toLocaleString('pt-BR')}%</span></span>
              <span className="rank-barra"><span style={{ width: x.pct + '%', background: cor }} /></span>
            </div>
          ))}
        </div>
      ) : <p className="fraco">{vazio}</p>}
    </div>
  );
}

export function PainelFinanceiro() {
  const vm = usePainelFinanceiro();
  useCarregando(vm.carregando);
  const n = vm.numeros, h = vm.honorarios;
  return (
    <section className="fin-painel">
      <div className="tarefas-barra-topo">
        <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>

      <div className="stat-grid fin-numeros">
        <Stat rotulo="Entradas" valor={reais(n.entradas)} cor="entrada" />
        <Stat rotulo="Saídas" valor={reais(n.saidas)} cor="saida" />
        <Stat rotulo="Resultado" valor={reais(n.resultado)} cor={n.resultado < 0 ? 'saida' : 'entrada'} />
        <Stat rotulo="Saldo do caixa hoje" valor={reais(n.saldo)} cor={n.saldo < 0 ? 'saida' : undefined} />
      </div>

      {!vm.carregando && !n.lancamentos ? (
        <Vazio icone="dinheiro" titulo="Nenhum lançamento neste período">
          <button type="button" className="btn btn-outline" onClick={() => vm.ir('caixa')}>Abrir o Caixa</button>
        </Vazio>
      ) : (
        <div className="fin-painel-colunas">
          <PorConta titulo="Para onde foi o dinheiro" itens={vm.saidasPorConta} cor="var(--destructive)" vazio="Nenhuma saída no período." />
          <PorConta titulo="De onde veio o dinheiro" itens={vm.entradasPorConta} cor="var(--success)" vazio="Nenhuma entrada no período." />
        </div>
      )}

      <div className="fin-painel-colunas">
        <div className="card">
          <h3>Honorários de {h.competencia}</h3>
          {!h.carregado ? <p className="fraco">Lendo…</p> : !h.total ? <p className="fraco">Nenhum contrato de honorário ativo.</p> : (
            <>
              <div className="rank">
                <div className="rank-item">
                  <span className="rank-nome">Recebido {reais(h.recebido)} de {reais(h.previsto)}</span><span className="rank-val num">{h.pct}%</span>
                  <span className="rank-barra"><span style={{ width: h.pct + '%', background: 'var(--success)' }} /></span>
                </div>
              </div>
              <p className="fin-painel-linha">{h.pagos} de {h.total} clientes pagaram · <b>{reais(h.emAberto)}</b> em aberto</p>
            </>
          )}
          <div className="btn-row"><button type="button" className="btn btn-outline" onClick={() => vm.ir('honorarios')}>Ver os honorários</button></div>
        </div>
        <div className="card">
          <h3>Notas fiscais emitidas no período</h3>
          {!vm.notas.carregada ? <p className="fraco">Lendo…</p> : (
            <p className="fin-painel-linha"><b className="fin-painel-grande num">{vm.notas.quantas}</b> {vm.notas.quantas === 1 ? 'nota autorizada' : 'notas autorizadas'} · {reais(vm.notas.valor)}</p>
          )}
          <div className="btn-row"><button type="button" className="btn btn-outline" onClick={() => vm.ir('notas')}>Ver as notas</button></div>
        </div>
      </div>

      <div className="card">
        <h3>Mês a mês (últimos 12 meses)</h3>
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Mês</th><th className="num">Entradas</th><th className="num">Saídas</th><th className="num">Resultado</th></tr></thead>
            <tbody>
              {vm.meses.map(m => (
                <tr key={m.mes}>
                  <td>{m.rotulo}</td>
                  <td className={'num' + (m.entradas ? ' fin-valor-entrada' : ' fraco')}>{m.entradas ? reais(m.entradas) : '—'}</td>
                  <td className={'num' + (m.saidas ? ' fin-valor-saida' : ' fraco')}>{m.saidas ? reais(m.saidas) : '—'}</td>
                  <td className={'num ' + (m.resultado < 0 ? 'fin-valor-saida' : m.resultado > 0 ? 'fin-valor-entrada' : '')}>{m.entradas || m.saidas ? reais(m.resultado) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
