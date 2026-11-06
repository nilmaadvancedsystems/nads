// Balancete importado: resumo por grupo (clicável = filtro) e as contas (conferencia.html renderPlano ~L2044).
import type { conferencia as c } from '@nads/core';
import type { useImportacao } from '../useImportacao';

type Plano = NonNullable<ReturnType<typeof useImportacao>['plano']>;

export function PlanoDeContas({ plano, onGrupo }: { plano: Plano; onGrupo: (g: c.Grupo) => void }) {
  return (
    <>
      <div className="stat-grid">
        {plano.resumo.map(r => (
          <button key={r.grupo} type="button" className={'stat stat-clicavel' + (r.ativo ? ' active' : '')} onClick={() => onGrupo(r.grupo)}>
            <p className="stat-label">{r.grupo}</p>
            <p className="stat-value">{r.qtd}</p>
          </button>
        ))}
      </div>
      <div className="table-wrap" style={{ marginTop: 14 }}>
        {plano.grupos.map(g => (
          <div key={g.grupo}>
            {plano.comTitulo && <h4 style={{ fontSize: 13, margin: '14px 0 6px', color: 'var(--ink-muted)' }}>{g.grupo}</h4>}
            <table>
              <thead><tr><th>Código</th><th>Conta</th><th>Natureza</th></tr></thead>
              <tbody>
                {g.contas.map(a => (
                  <tr key={a.codigo}>
                    <td>{a.codigo}</td>
                    <td className="wrap" style={a.sintetica ? { fontWeight: 700 } : undefined}>{a.nome}</td>
                    <td>{a.dc === 'D' ? 'Devedora' : 'Credora'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
