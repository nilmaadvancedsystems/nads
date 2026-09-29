// Contábil: a visão de cima (só leitura). "Visão geral" = cada etapa em todas as empresas e as
// objeções mais comuns; "Paradas" = as etapas interrompidas, com o motivo.
import { useCarregando } from '@nads/ui';
import { useVisaoContabil } from './useVisaoContabil';

export function VisaoContabil({ pagina }: { pagina: string }) {
  const vm = useVisaoContabil();
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-filtros">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="hint">Competência</span>
          <select className="select-compact" value={vm.competencia} onChange={e => vm.setCompetencia(e.target.value)}>
            {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </label>
      </div>
      {vm.carregando ? <p className="empty">Carregando…</p> : pagina === 'paradas' ? (
        vm.paradas.length === 0 ? <p className="empty">Nenhuma etapa parada nesta competência.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Empresa</th><th>Etapa</th><th>Motivo</th><th>Quem</th><th>Quando</th></tr></thead>
              <tbody>
                {vm.paradas.map(p => (
                  <tr key={p.chave}>
                    <td>{p.codigo != null ? p.codigo + ' · ' : ''}{p.empresa}</td>
                    <td>{p.etapa}</td>
                    <td className="wrap">{p.motivo}{p.observacao && <span className="hint"> — {p.observacao}</span>}</td>
                    <td>{p.por}</td>
                    <td className="num">{p.em}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <>
          <div className="card">
            <div className="card-head"><h3>Etapas em {vm.totalEmpresas} empresas</h3></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Etapa</th><th /><th className="num">Feitas</th><th className="num">Não se aplica</th><th className="num">Paradas</th><th className="num">Pendentes</th></tr></thead>
                <tbody>
                  {vm.etapas.map(e => (
                    <tr key={e.etapa}>
                      <td>{e.nome}</td>
                      <td style={{ width: '30%' }}>
                        <span className="tarefas-barra larga">
                          <span style={{ width: (100 * (e.feitas + e.dispensadas) / Math.max(1, vm.totalEmpresas)) + '%' }} />
                          <span className="parada" style={{ width: (100 * e.interrompidas / Math.max(1, vm.totalEmpresas)) + '%' }} />
                        </span>
                      </td>
                      <td className="num">{e.feitas}</td>
                      <td className="num">{e.dispensadas}</td>
                      <td className="num">{e.interrompidas}</td>
                      <td className="num">{e.pendentes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>O que mais trava</h3></div>
            {vm.objecoes.length === 0 ? <p className="empty">Nenhuma objeção registrada nesta competência.</p> : (
              <ul className="tarefas-objecoes">
                {vm.objecoes.map(o => (
                  <li key={o.etapa + o.objecao}><span className="badge badge-neutral num">{o.qtd}</span> {o.texto} <span className="hint">· {o.nomeEtapa}</span></li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
