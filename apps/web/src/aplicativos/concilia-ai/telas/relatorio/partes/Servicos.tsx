// Relatório › Tomados/Prestados (#confServ): números, conferência com o saldo do balancete
// e lançamento fora do padrão agrupado por fornecedor/cliente.
// Origem: conferencia.html ~L1225-1231 e renderConfServ (~L4617-4729).
import { conferencia as c, formatos } from '@nads/core';
import { Stat } from '@nads/ui';
import type { useRelatorio } from '../useRelatorio';
import { IconePassivo, linhaPassivo, SaldoCelula, Situacao } from './Situacao';

type VM = ReturnType<typeof useRelatorio>;
type Serv = NonNullable<VM['serv']>;
const { brl, lancN, lancComZeros } = formatos;

const ESTILO_GRUPO = { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 8, background: 'var(--surface)', overflow: 'hidden' } as const;
const ESTILO_LI = { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 13.5, flexWrap: 'wrap' } as const;

export function Servicos({ vm, tipo }: { vm: VM; tipo: c.TipoServico }) {
  const r = vm.serv;
  if (!r) return null;
  return (
    <div id="confServ">
      <div className="stat-grid" id="confServStats">
        {r.stats.map(s => <Stat key={s.rotulo} rotulo={s.rotulo} valor={s.valor} cor={s.cor} />)}
      </div>
      <div className="cc-bal">
        <div id="confServBal">
          {!r.saldo.length ? <p className="empty">Nenhuma nota no período.</p> : <SaldoServicos r={r} onRevisar={vm.revisar} />}
        </div>
      </div>
      <div className="card" id="confServDiv">
        {!r.temDivergencias ? (
          <>
            <div className="card-head"><h3>Lançamento fora do padrão</h3></div>
            <p className="empty">Nenhuma nota fora do padrão.</p>
          </>
        ) : (
          <>
            <div className="card-head">
              <h3>Lançamento fora do padrão</h3>
              <label className="card-head-ctl">Ordenar por{' '}
                <select className="select-compact" value={vm.ordemServ} onChange={ev => vm.setOrdemServ(ev.target.value as c.OrdemServ)}>
                  {r.ordens.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
                </select>
              </label>
            </div>
            {r.pendentes.length
              ? r.pendentes.map(g => <Grupo key={g.key} vm={vm} r={r} tipo={tipo} gr={g} marcado={false} />)
              : <p className="empty">Nenhuma pendente — tudo corrigido.</p>}
            {r.corrigidos.length > 0 && (
              <>
                <p className="hint" style={{ marginTop: 16, fontWeight: 600, color: 'var(--ink)' }}>Corrigidos ({r.qtdCorrigidos})</p>
                {r.corrigidos.map(g => <Grupo key={g.key} vm={vm} r={r} tipo={tipo} gr={g} marcado />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SaldoServicos({ r, onRevisar }: { r: Serv; onRevisar: (contas: string[]) => void }) {
  return (
    <div className="table-wrap" style={{ maxHeight: 'none' }}>
      <table className="table-compact">
        <thead><tr><th>Conta</th><th>Descrição</th><th className="num">Notas</th><th className="num">Soma das notas</th><th className="num">Saldo do balancete</th><th className="num th-sit">Situação</th></tr></thead>
        <tbody>
          {r.saldo.map((l, i) => (
            <tr key={l.contas.join('+') || 'sem' + i} {...linhaPassivo(l.avisoPassivo)}>
              <td style={{ whiteSpace: 'nowrap' }}>
                <IconePassivo aviso={l.avisoPassivo} />
                {l.contas.length ? <b>{l.titulo}</b> : <span style={{ color: 'var(--ink-muted)' }}>{l.titulo}</span>}
              </td>
              <td className="wrap">{l.descricao}</td>
              <td className="num" title={r.tituloNotas(l)}>{l.qtdNotas}</td>
              <td className="num">{brl(l.somaNotas)}</td>
              <td className="num"><SaldoCelula saldo={l.saldo} contasFora={l.contasFora} /></td>
              <td><div className="sit"><Situacao sit={l.situacao} contas={l.contas} servico onRevisar={onRevisar} /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Grupo({ vm, r, tipo, gr, marcado }: { vm: VM; r: Serv; tipo: c.TipoServico; gr: c.GrupoForaDoPadraoServ; marcado: boolean }) {
  const cat = gr.cat;
  return (
    <details className="dp-grupo" open={!marcado} style={ESTILO_GRUPO}>
      <summary style={{ cursor: 'pointer', padding: '11px 13px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, width: 'calc(100% - 22px)', verticalAlign: 'middle' }}>
          <input type="checkbox" checked={marcado} aria-label="Marcar todo o grupo como corrigido" onChange={ev => vm.marcarServGrupoCorrigido(tipo, gr, ev.target.checked)} />
          <b title={gr.nome} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{gr.nome}</b>
          <span className="badge badge-neutral" style={{ flex: 'none' }}>{gr.itens.length}</span>
        </span>
      </summary>
      {gr.sugerirCategorias.length > 0 && (
        <div className="serv-div-acoes" style={{ padding: '0 13px 8px 39px' }}>
          <span className="hint">{r.dicaSugestao(gr)}</span>
          {gr.sugerirCategorias.map(x => (
            <button key={x.id} type="button" className="btn btn-sm" onClick={() => vm.colocarNaCategoria(tipo, x.id, gr.nome)}>Colocar em {x.nome}</button>
          ))}
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: '0 13px 10px 39px' }}>
        {gr.itens.map(it => {
          const n = it.nota;
          const l = lancN(n.lanc);
          return (
            <li key={it.chave} style={ESTILO_LI}>
              <input type="checkbox" checked={marcado} aria-label="Marcar como corrigido" onChange={ev => vm.marcarServCorrigido(tipo, it, ev.target.checked)} />
              <span style={{ flex: '1 1 200px', minWidth: 0 }}>{n.data} · nota {n.numero}</span>
              <span className="hint" style={{ whiteSpace: 'nowrap' }}>
                Atual {l ? <b style={{ color: 'var(--ink)' }}>{n.lanc}</b> : <span className="pill-vazio">VAZIO</span>} — Lanç. Configurado: <b style={{ color: 'var(--ink)' }}>{l ? lancComZeros(cat.lanc, n.lanc) : cat.lanc}</b>
              </span>
              <span className="num" style={{ width: 90, textAlign: 'right' }}>{brl(n.valor)}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
