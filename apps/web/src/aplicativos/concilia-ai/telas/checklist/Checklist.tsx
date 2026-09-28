// Movimento › Checklist — "Naturezas de CFOP" (#view-mov-naturezas, conferencia.html
// ~L1233-1244; renderChecklistNatureza ~L3080-3150).
import { conferencia as c, formatos } from '@nads/core';
import { Segmentado } from '@nads/ui';
import { OPCOES_STATUS, useChecklist } from './useChecklist';

const { brl } = formatos;
const ESTILO_CONTA = { fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 } as const;

export function Checklist() {
  const vm = useChecklist();
  return (
    <section>
      <Segmentado id="natSeg" valor={vm.tipo} opcoes={vm.recortes} onMudar={vm.escolherRecorte} />
      <div className="card">
        <div className="chip-row" id="natFiltros" style={{ margin: '0 0 12px' }}>
          <span className="chip-lbl">Situação</span>
          <select className="select-compact cc-status-sel" aria-label="Situação" value={vm.status} onChange={ev => vm.setStatus(ev.target.value as c.FiltroMovimento['status'])}>
            {OPCOES_STATUS.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
          </select>
          {vm.busca && (
            <>
              <span className="chip-sep" />
              <button type="button" className="chip-f on" title="Limpar filtro" onClick={vm.limparBusca}>CFOP {vm.busca} ×</button>
            </>
          )}
          {vm.mesesMarcados && (
            <>
              <span className="chip-sep" />
              <span className="hint" style={{ margin: 0 }}>Meses marcados no Relatório: {vm.mesesMarcados}</span>
            </>
          )}
        </div>
        <div id="natLista">
          {vm.vazio ? <p className="empty">{vm.vazio}</p> : (
            <div className="table-wrap" style={{ maxHeight: 'none' }}>
              <table>
                <thead><tr><th style={{ width: 34 }} /><th>CFOPs — Natureza</th><th className="num">Notas</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {vm.linhas.map(l => (
                    <tr key={l.chave} className={l.marcado ? 'feito' + (l.anima ? ' anima' : '') : undefined}>
                      <td>
                        {l.automatico
                          // automático = caixinha cinza (sem cadeado); o manual continua vermelho
                          ? <input type="checkbox" checked={l.marcado} disabled className="chk-auto" title="Marcado automaticamente — bateu com o balancete. Pra remover, use a Auditoria." readOnly />
                          : <input type="checkbox" checked={l.marcado} aria-label="Marcar como conferido" onChange={ev => vm.marcar(l, ev.target.checked)} />}
                      </td>
                      <td className="wrap">
                        <span className={'badge ' + (l.tipo === 'Entrada' ? 'badge-bad' : 'badge-ok')} style={{ marginRight: 7 }}>{l.tipo}</span>
                        <span className="risco">{l.titulo}</span>
                        <span className="cc-mini"><span style={{ width: l.proporcao + '%', background: l.tipo === 'Entrada' ? 'var(--danger)' : 'var(--success)' }} /></span>
                        <div style={l.contas.length ? ESTILO_CONTA : { ...ESTILO_CONTA, fontStyle: 'italic' }}>{l.contaTexto}</div>
                      </td>
                      <td className="num">{l.qtdNotas}</td>
                      <td className="num">{brl(l.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
