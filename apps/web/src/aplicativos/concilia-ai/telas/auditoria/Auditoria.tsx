// Auditoria › Histórico (conferencia.html ~L1256-1262; tabela do renderAuditoria ~L3640-3650).
import { formatos } from '@nads/core';
import { useAuditoria } from './useAuditoria';

const BADGE = { ok: 'badge-ok', bad: 'badge-bad', neutral: 'badge-neutral' } as const;

export function Auditoria() {
  const vm = useAuditoria();
  return (
    <section>
      <div className="card">
        <h3>Histórico</h3>
        <div id="audBox">
          {!vm.linhas.length ? <p className="empty">Nada registrado ainda.</p> : (
            <div className="table-wrap" style={{ maxHeight: 640 }}>
              <table>
                <thead><tr><th>Data/hora</th><th>Tipo</th><th>Ação</th><th>Detalhe</th><th>Origem</th><th></th></tr></thead>
                <tbody>
                  {vm.linhas.map((l, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatos.dataHora(l.ts)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{l.tipo}</td>
                      <td><span className={'badge ' + BADGE[l.tom]}>{l.acao}</span></td>
                      <td className="wrap">{l.detalhe}</td>
                      <td><span className="badge badge-neutral">{l.origem}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {l.remover && <button className="btn btn-danger" type="button" onClick={() => l.remover && vm.remover(l.remover)}>Remover</button>}
                      </td>
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
