// O que foi importado, do jeito que veio (conferencia.html renderImportadas ~L2998, renderServImportados ~L4394).
import { formatos } from '@nads/core';
import { Stat } from '@nads/ui';
import { LIMITE_LINHAS, type useImportacao } from '../useImportacao';

type Notas = NonNullable<ReturnType<typeof useImportacao>['notas']>;
type Servicos = NonNullable<ReturnType<typeof useImportacao>['servicos']>;
const { brl } = formatos;

export function NotasImportadas({ r }: { r: Notas }) {
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Notas" valor={r.qtd} />
        <Stat rotulo="Valor total" valor={brl(r.total)} />
        <Stat rotulo="Período" valor={r.periodo} grande={false} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Nota</th><th>Fornecedor / cliente</th><th>CFOP</th><th>Lanç.</th><th className="num">Valor</th></tr></thead>
          <tbody>
            {r.linhas.map((n, i) => (
              <tr key={i}><td>{n.data}</td><td>{n.numero}</td><td className="wrap">{n.nome}</td><td>{n.cfop}</td><td>{n.lanc || '—'}</td><td className="num">{brl(n.valor)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.qtd > LIMITE_LINHAS && <p className="hint">Mostrando {LIMITE_LINHAS} de {r.qtd}. Veja todas em Movimento › Consulta.</p>}
    </>
  );
}

export function ServicosImportados({ r }: { r: Servicos }) {
  return (
    <>
      <div className="stat-grid">
        <Stat rotulo="Notas" valor={r.qtd} />
        <Stat rotulo={r.rotValor + ' total'} valor={brl(r.total)} />
        <Stat rotulo={r.rotParticipantes} valor={r.qtdParticipantes} />
        <Stat rotulo="Período" valor={r.periodo} grande={false} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data</th><th>Nota</th><th>{r.rotParticipante}</th><th>Lanç.</th>{r.comIss && <th className="num">ISS</th>}<th className="num">{r.rotValor}</th></tr></thead>
          <tbody>
            {r.linhas.map((n, i) => (
              <tr key={i}><td>{n.data}</td><td>{n.numero}</td><td className="wrap">{n.nome}</td><td>{n.lanc || '—'}</td>{r.comIss && <td className="num">{brl(n.iss || 0)}</td>}<td className="num">{brl(n.valor)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.qtd > LIMITE_LINHAS && <p className="hint">Mostrando {LIMITE_LINHAS} de {r.qtd}. Veja todas em Movimento › Consulta.</p>}
    </>
  );
}
