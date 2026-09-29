// Tabela da conferência: situação, data (e a do sistema quando difere), histórico (e o do sistema
// quando difere), os dois valores e o que houve.
import { extrator as x } from '@nads/core';
import type { useConferencia } from '../useConferencia';

type Linha = ReturnType<typeof useConferencia>['linhas'][number];

const BADGE: Record<x.Situacao, string> = { ok: 'badge-ok', faltando: 'badge-bad ext-badge-falta', diferente: 'badge-bad', amais: 'badge-warn', duplicado: 'badge-neutral ext-badge-dup' };

function Valor({ v }: { v: number | null }) {
  if (v == null) return <td className="num ext-mut">—</td>;
  return <td className={'num ' + (v < 0 ? 'ext-neg' : 'ext-pos')}>{x.valorBR(v)}</td>;
}

export function TabelaConferencia({ linhas }: { linhas: Linha[] }) {
  return (
    <div className="table-wrap">
      <table className="table-compact ext-tabela">
        <thead><tr><th>Situação</th><th>Data</th><th>Histórico</th><th className="num">Extrato</th><th className="num">Sistema</th><th>O que houve</th></tr></thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.chave}>
              <td><span className={'badge ' + BADGE[l.situacao]}>{l.rotulo}</span></td>
              <td style={{ whiteSpace: 'nowrap' }}>{l.data}{l.dataSistema && <span className="ext-sub">Sistema: {l.dataSistema}</span>}</td>
              <td className="wrap">
                {l.historico}
                {l.historicoSistema && <span className="ext-sub">Sistema: {l.historicoSistema}</span>}
                {l.copia && <span className="ext-sub">{l.copia}</span>}
              </td>
              <Valor v={l.valorExtrato} />
              <Valor v={l.valorSistema} />
              <td className="wrap ext-motivo">{l.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
