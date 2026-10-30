// View da REINF (Fiscal › REINF): em cima a competência e a busca; os três números (empresas, pendentes, transmitidas), que
// filtram, e o andamento da competência; embaixo uma linha por empresa — Nº, cliente, a situação na competência, até quando
// foi transmitida, a última transmissão (quando e quem), as retificadas — e as ações: Transmitir (ou Desfazer) e Retificar.
// Maior e mais limpa em 30/10/2026 ("essa tela da reinf precisa ser maior e a deixe de maneira mais bonita"): a tabela ocupa
// a altura da tela e os números viraram os filtros.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useReinf } from './useReinf';

export function Reinf() {
  const vm = useReinf();
  const r = vm.resumo;
  const feito = r.total ? Math.round((r.transmitidas / r.total) * 100) : 0;
  const numeros = [
    { id: 'todas', rotulo: 'Empresas', valor: r.total },
    { id: 'pendentes', rotulo: 'Pendentes', valor: r.pendentes },
    { id: 'transmitidas', rotulo: 'Transmitidas', valor: r.transmitidas },
  ] as const;
  return (
    <section className="reinf">
      <div className="tarefas-barra-topo">
        <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} aria-label="Buscar empresa" />
        </label>
      </div>
      <div className="stat-grid reinf-numeros">
        {numeros.map(n => (
          <button key={n.id} type="button" className={'stat stat-clicavel reinf-numero-' + n.id + (vm.filtro === n.id ? ' active' : '')}
            aria-pressed={vm.filtro === n.id} onClick={() => vm.setFiltro(n.id)}>
            <p className="stat-label">{n.rotulo}</p>
            <p className="stat-value num">{n.valor}</p>
          </button>
        ))}
        <div className="stat reinf-andamento">
          <p className="stat-label">Andamento de {vm.rotuloCompetencia}</p>
          <p className="stat-value num">{feito}%</p>
          <span className="reinf-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={feito} aria-label={'Transmitidas: ' + feito + '%'}>
            <span style={{ width: feito + '%' }} />
          </span>
        </div>
      </div>
      <div className="table-wrap reinf-tabela-wrap">
        <table className="table-compact reinf-tabela">
          <thead>
            <tr>
              <th className="num">Nº</th><th>Cliente</th><th>Situação</th><th>Transmitido até</th><th>Última transmissão</th><th>Retificadas</th><th />
            </tr>
          </thead>
          <tbody>
            {vm.linhas.map(l => (
              <tr key={l.codigo} className={l.transmitida ? 'reinf-feita' : undefined}>
                <td className="num reinf-cod">{l.codigo}</td>
                <td className="wrap reinf-nome">{l.nome}</td>
                <td>{l.transmitida
                  ? <span className="badge badge-ok"><Icone nome="check" width={12} height={12} />Transmitida</span>
                  : <span className="badge badge-neutral">Pendente</span>}</td>
                <td className="num">{l.ate}</td>
                <td className="hint">{l.ultima}</td>
                <td>{l.retificadas.length ? <span className="reinf-retificadas">{l.retificadas.map(x => <span key={x} className="badge badge-warn">{x}</span>)}</span> : ''}</td>
                <td className="reinf-acoes">
                  {l.transmitida
                    ? <button type="button" className="btn btn-sm" onClick={() => vm.desfazer(l.codigo)} title="Desfazer a transmissão desta competência">Desfazer</button>
                    : <button type="button" className="btn btn-sm btn-primary" onClick={() => vm.transmitir(l.codigo)}><Icone nome="check" width={14} height={14} />Transmitir</button>}
                  <button type="button" className={'btn btn-sm btn-ghost' + (l.retificadaNaCompetencia ? ' reinf-retificada' : '')} onClick={() => vm.retificar(l.codigo)}
                    title={l.retificadaNaCompetencia ? 'Tirar a retificação desta competência' : 'Retificou esta competência'}>
                    {l.retificadaNaCompetencia ? 'Retificada' : 'Retificar'}
                  </button>
                </td>
              </tr>
            ))}
            {!vm.linhas.length && <tr><td colSpan={7} className="hint reinf-vazio">Nenhuma empresa com esse filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
