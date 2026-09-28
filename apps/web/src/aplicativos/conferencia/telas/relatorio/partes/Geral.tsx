// Relatório › Geral/Entradas/Saídas: números do período, conferência com o saldo do
// balancete, gráfico por mês e maiores naturezas (#cc-aba-geral, conferencia.html
// ~L1201-1222; renderGeral ~L3593, renderCcBalancete ~L3508, renderCcChart ~L3419,
// renderCcRank ~L3447).
import { conferencia as c, formatos } from '@nads/core';
import { Stat } from '@nads/ui';
import type { useRelatorio } from '../useRelatorio';
import { IconePassivo, linhaPassivo, Situacao } from './Situacao';

type VM = ReturnType<typeof useRelatorio>;
const { brl } = formatos;

export function Geral({ vm }: { vm: VM }) {
  return (
    <div id="cc-aba-geral">
      <div className="stat-grid" id="ccStats">
        {vm.stats.map(s => <Stat key={s.rotulo} rotulo={s.rotulo} valor={s.valor} cor={s.cor} />)}
      </div>
      {vm.saldo.length > 0 && (
        <div className="cc-bal" id="ccPainelBalancete">
          <div id="ccBalancete"><SaldoBalancete linhas={vm.saldo} onRevisar={vm.revisar} /></div>
        </div>
      )}
      <div className="dash-grid">
        {vm.grafico && (
          <div className="painel" id="ccPainelMes">
            <div className="painel-head">
              <p className="painel-titulo">Entradas × saídas por mês</p>
            </div>
            <div id="ccChart">
              <div className="chart">
                {vm.grafico.map(m => (
                  <button key={m.comp} type="button" className={'chart-col' + (m.ligado ? ' on' : '')} title={m.titulo} onClick={() => vm.alternarMes(m.comp)}>
                    <span className="chart-plot">
                      <span className="chart-bar ent" style={{ height: m.alturaEnt + 'px' }} />
                      <span className="chart-bar sai" style={{ height: m.alturaSai + 'px' }} />
                    </span>
                    <span className="chart-lbl">{m.rotulo}</span>
                  </button>
                ))}
              </div>
              <div className="chart-legend">
                <span><i className="chart-dot" style={{ background: 'var(--danger)' }} />Entradas</span>
                <span><i className="chart-dot" style={{ background: 'var(--success)' }} />Saídas</span>
              </div>
            </div>
          </div>
        )}
        {vm.rank && (
          <div className="painel" id="ccPainelTop">
            <div className="painel-head">
              <p className="painel-titulo">Maiores naturezas</p>
              <p className="painel-sub">por valor no período</p>
            </div>
            <div id="ccRank">
              <div className="rank">
                {vm.rank.map(l => (
                  <button key={l.k} type="button" className="rank-item" title={l.titulo} onClick={() => vm.abrirNatureza(l.cfops)}>
                    <span className="rank-nome">{l.nome}</span>
                    <span className="rank-val">{brl(l.valor)}</span>
                    <span className="rank-barra"><span style={{ width: l.largura + '%', background: l.tipo === 'Entrada' ? 'var(--danger)' : 'var(--success)' }} /></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SaldoBalancete({ linhas, onRevisar }: { linhas: c.LinhaSaldo[]; onRevisar: (contas: string[]) => void }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 'none' }}>
      <table className="table-compact">
        <thead><tr><th>Conta</th><th>CFOP</th><th className="num">Notas</th><th className="num">Soma das notas</th><th className="num">Saldo do balancete</th><th className="num th-sit">Situação</th></tr></thead>
        <tbody>
          {linhas.map(l => {
            const chave = l.contas.join('+');
            if (l.emServicos) {
              const rotS = l.emServicos === 'tomados' ? 'Tomados' : 'Prestados';
              return (
                <tr key={chave} className="linha-em-serv" title={'Essa conta também tem notas de serviço: a conferência dela é feita em ' + rotS + ', somando as duas.'}>
                  <td style={{ whiteSpace: 'nowrap' }}><b>{l.titulo}</b></td>
                  <td className="wrap">{l.cfops.join(', ')}</td>
                  <td className="num">{l.qtdNotas}</td>
                  <td className="num">{brl(l.somaNotas)}</td>
                  <td className="num">—</td>
                  <td className="num"><span className="badge badge-neutral">Conferida em {rotS}</span><span className="sit-vazio" /></td>
                </tr>
              );
            }
            return (
              <tr key={chave} {...linhaPassivo(l.avisoPassivo)}>
                <td style={{ whiteSpace: 'nowrap' }}><IconePassivo aviso={l.avisoPassivo} /><b>{l.titulo}</b></td>
                <td className="wrap">{l.cfops.join(', ')}</td>
                <td className="num">{l.qtdNotas}</td>
                <td className="num">{brl(l.somaNotas)}</td>
                <td className="num">{l.saldo == null ? '—' : brl(l.saldo)}</td>
                <td><div className="sit"><Situacao sit={l.situacao} contas={l.contas} onRevisar={onRevisar} /></div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
