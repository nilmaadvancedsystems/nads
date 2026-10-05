// Relatório › Entradas/Saídas: "Lançamento fora do padrão do CFOP" (#confDivEntradas /
// #confDivSaidas). Origem: conferencia.html renderNotas (~L2985-2996) e renderDivergencias
// (~L3180-3231).
import { conferencia as c, formatos } from '@nads/core';
import type { useRelatorio } from '../useRelatorio';

type VM = ReturnType<typeof useRelatorio>;
const { reais, lancComZeros } = formatos;

const ESTILO_GRUPO = { border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 8, background: 'var(--surface)', overflow: 'hidden' } as const;
const ESTILO_LI = { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: 13.5, flexWrap: 'wrap' } as const;

export function ForaDoPadraoFiscal({ vm, tipo }: { vm: VM; tipo: c.TipoNotaFiscal }) {
  const f = vm.fiscal;
  if (!f) return null;
  if (!f.temDivergencias) {
    return (
      <div className="card" id={tipo === 'entradas' ? 'confDivEntradas' : 'confDivSaidas'}>
        <div className="card-head"><h3>Lançamento fora do padrão do CFOP</h3></div>
        <p className="empty">{f.vazio}</p>
      </div>
    );
  }
  return (
    <div className="card" id={tipo === 'entradas' ? 'confDivEntradas' : 'confDivSaidas'}>
      <div className="card-head">
        <h3>Lançamento fora do padrão do CFOP</h3>
        <label className="card-head-ctl">Ordenar por{' '}
          <select className="select-compact" value={vm.ordemDiv} onChange={ev => vm.setOrdemDiv(ev.target.value as c.OrdemGrupos)}>
            <option value="cfop">CFOP (A-Z)</option>
            <option value="valor">Valor (maior primeiro)</option>
            <option value="data">Data</option>
          </select>
        </label>
      </div>
      {f.pendentes.length
        ? f.pendentes.map(g => <Grupo key={g.key} vm={vm} tipo={tipo} gr={g} marcado={false} />)
        : <p className="empty">Nenhuma pendente — tudo corrigido.</p>}
      {f.corrigidos.length > 0 && (
        <>
          <p className="hint" style={{ marginTop: 16, fontWeight: 600, color: 'var(--ink)' }}>Corrigidos ({f.qtdCorrigidos})</p>
          {f.corrigidos.map(g => <Grupo key={g.key} vm={vm} tipo={tipo} gr={g} marcado />)}
        </>
      )}
    </div>
  );
}

function Grupo({ vm, tipo, gr, marcado }: { vm: VM; tipo: c.TipoNotaFiscal; gr: c.GrupoForaDoPadrao; marcado: boolean }) {
  return (
    <details className="dp-grupo" open={!marcado} style={ESTILO_GRUPO}>
      <summary style={{ cursor: 'pointer', padding: '11px 13px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, width: 'calc(100% - 22px)', verticalAlign: 'middle' }}>
          <input type="checkbox" checked={marcado} aria-label="Marcar todo o grupo como corrigido" onChange={ev => vm.marcarGrupoCorrigido(tipo, gr, ev.target.checked)} />
          <b title={gr.titulo} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{gr.titulo}</b>
          <span className="badge badge-neutral" style={{ flex: 'none' }}>{gr.itens.length}</span>
          <span className="hint" style={{ marginLeft: 'auto' }}>{reais(gr.total)}</span>
        </span>
      </summary>
      <ul style={{ listStyle: 'none', margin: 0, padding: '0 13px 10px 39px' }}>
        {gr.itens.map(d => {
          const n = d.nota;
          return (
            <li key={d.chave} style={ESTILO_LI}>
              <input type="checkbox" checked={marcado} aria-label="Marcar como corrigido" onChange={ev => vm.marcarNotaCorrigida(tipo, d, ev.target.checked)} />
              <span style={{ flex: '1 1 260px', minWidth: 0 }}>{n.data} · nota {n.numero} · {n.nome} · CFOP {n.cfop}</span>
              {/* lançamento cadastrado pelo usuário (à vista / a prazo): "Lanç. Configurado"; tirado da maioria das notas: "Lanç. Padrão" */}
              <span className="hint" style={{ whiteSpace: 'nowrap' }}>
                Atual <b style={{ color: 'var(--ink)' }}>{n.lanc}</b> — {d.cadastrado ? 'Lanç. Configurado' : 'Lanç. Padrão'}: <b style={{ color: 'var(--ink)' }}>{lancComZeros(d.padrao, n.lanc)}</b>
              </span>
              <span className="num" style={{ width: 90, textAlign: 'right' }}>{reais(n.valor)}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
