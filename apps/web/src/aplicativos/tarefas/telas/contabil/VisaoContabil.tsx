// Contábil: a visão de cima (só leitura). "Visão geral" = cada etapa em todas as empresas e as
// objeções mais comuns; "Paradas" = as etapas interrompidas, com o motivo.
import { MenuSuspenso, useCarregando } from '@nads/ui';
import { useVisaoContabil } from './useVisaoContabil';

export function VisaoContabil({ pagina, dep }: { pagina: string; dep?: 'contabil' | 'fiscal' | 'dp' }) {
  const vm = useVisaoContabil(dep);
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-filtros">
        {/* a competência no mesmo menu com o calendário da Minhas empresas (revisão da UI, 16/10/2026: eram três peças diferentes) */}
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
      </div>
      {vm.carregando ? null : pagina === 'paradas' ? (
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
                <thead><tr><th>Etapa</th><th /><th className="num">Feitas</th><th className="num">Não se aplica</th><th className="num">Paradas</th><th className="num">Pendentes</th><th className="num" title="A mediana do tempo da etapa (na mesma sentada)">Tempo</th></tr></thead>
                <tbody>
                  {vm.etapas.map(e => (
                    <tr key={e.etapa}>
                      <td>{e.nome}</td>
                      <td style={{ width: '30%' }}>
                        {/* a barra sobre as empresas que têm a etapa (o LCDPR só na 62; 16/10/2026) */}
                        <span className="tarefas-barra larga">
                          <span style={{ width: (100 * (e.feitas + e.dispensadas) / Math.max(1, e.total)) + '%' }} />
                          <span className="parada" style={{ width: (100 * e.interrompidas / Math.max(1, e.total)) + '%' }} />
                        </span>
                      </td>
                      <td className="num">{e.feitas}</td>
                      <td className="num">{e.dispensadas}</td>
                      <td className="num">{e.interrompidas}</td>
                      <td className="num">{e.pendentes}</td>
                      <td className="num" title={vm.tempos[e.etapa] ? 'Mediana de ' + vm.tempos[e.etapa].n + (vm.tempos[e.etapa].n === 1 ? ' vez' : ' vezes') : undefined}>
                        {vm.tempos[e.etapa] ? (vm.tempos[e.etapa].minutos >= 60 ? Math.floor(vm.tempos[e.etapa].minutos / 60) + 'h' + String(vm.tempos[e.etapa].minutos % 60).padStart(2, '0') : vm.tempos[e.etapa].minutos + ' min') : '—'}
                      </td>
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
