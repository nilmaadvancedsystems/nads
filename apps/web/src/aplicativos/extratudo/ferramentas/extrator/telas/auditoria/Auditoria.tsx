// Auditoria › Histórico do Extrator (mesma tabela da Auditoria da Conferência).
import { formatos } from '@nads/core';
import { useAuditoria } from './useAuditoria';
import { Vazio } from '@nads/ui';

const BADGE = { ok: 'badge-ok', bad: 'badge-bad', neutral: 'badge-neutral' } as const;

export function Auditoria() {
  const vm = useAuditoria();
  return (
    <section>
      <div className="card">
        <h3>Histórico</h3>
        {!vm.linhas.length ? <Vazio icone="clock" titulo="Nada registrado ainda" /> : (
          <div className="table-wrap" style={{ maxHeight: 640 }}>
            <table>
              <thead><tr><th>Data/hora</th><th>Ação</th><th>Detalhe</th></tr></thead>
              <tbody>
                {vm.linhas.map((l, i) => (
                  <tr key={i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatos.dataHora(l.ts)}</td>
                    <td><span className={'badge ' + BADGE[l.tom]}>{l.acao}</span></td>
                    <td className="wrap">{l.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
