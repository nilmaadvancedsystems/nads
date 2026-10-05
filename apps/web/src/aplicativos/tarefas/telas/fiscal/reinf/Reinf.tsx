// View da REINF (Fiscal › REINF): em cima a competência, quantas transmitidas e quantas faltam, o filtro e a busca; embaixo
// uma linha por empresa — Nº, cliente, a situação na competência, até quando foi transmitida, a última transmissão (quando
// e quem), as retificadas — e as ações: Transmitir (ou Desfazer) e Retificar.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useReinf } from './useReinf';

export function Reinf() {
  const vm = useReinf();
  return (
    <section>
      <div className="tarefas-barra-topo">
        <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <div className="chip-row reinf-filtros">
          <button type="button" className={'chip-f' + (vm.filtro === 'todas' ? ' on' : '')} onClick={() => vm.setFiltro('todas')}>Todas <span className="gh-counter">{vm.resumo.total}</span></button>
          <button type="button" className={'chip-f' + (vm.filtro === 'pendentes' ? ' on' : '')} onClick={() => vm.setFiltro('pendentes')}>Pendentes <span className="gh-counter">{vm.resumo.pendentes}</span></button>
          <button type="button" className={'chip-f' + (vm.filtro === 'transmitidas' ? ' on' : '')} onClick={() => vm.setFiltro('transmitidas')}>Transmitidas <span className="gh-counter">{vm.resumo.transmitidas}</span></button>
        </div>
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} aria-label="Buscar empresa" />
        </label>
      </div>
      <div className="table-wrap">
        <table className="table-compact reinf-tabela">
          <thead>
            <tr>
              <th className="num">Nº</th><th>Cliente</th><th>Situação</th><th>Transmitido até</th><th>Última transmissão</th><th>Retificadas</th><th />
            </tr>
          </thead>
          <tbody>
            {vm.linhas.map(l => (
              <tr key={l.codigo}>
                <td className="num"><b>{l.codigo}</b></td>
                <td className="wrap">{l.nome}</td>
                <td>{l.transmitida ? <span className="badge badge-ok">Transmitida</span> : <span className="badge badge-neutral">Pendente</span>}</td>
                <td>{l.ate}</td>
                <td className="hint">{l.ultima}</td>
                <td>{l.retificadas.length ? <span className="reinf-retificadas">{l.retificadas.map(r => <span key={r} className="badge badge-warn">{r}</span>)}</span> : ''}</td>
                <td className="reinf-acoes">
                  {l.transmitida
                    ? <button type="button" className="btn" onClick={() => vm.desfazer(l.codigo)} title="Desfazer a transmissão desta competência">Desfazer</button>
                    : <button type="button" className="btn btn-primary" onClick={() => vm.transmitir(l.codigo)}>Transmitir</button>}
                  <button type="button" className={'btn' + (l.retificadaNaCompetencia ? ' reinf-retificada' : '')} onClick={() => vm.retificar(l.codigo)}
                    title={l.retificadaNaCompetencia ? 'Tirar a retificação desta competência' : 'Retificou esta competência'}>
                    {l.retificadaNaCompetencia ? 'Retificada' : 'Retificar'}
                  </button>
                </td>
              </tr>
            ))}
            {!vm.linhas.length && <tr><td colSpan={7} className="hint">Nenhuma empresa com esse filtro.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
