// View da REINF (Fiscal › REINF): em cima a competência e a busca; os três números (empresas, pendentes, transmitidas), que
// filtram, e o andamento da competência; embaixo uma linha por empresa — Nº, cliente, a situação na competência, até quando
// foi transmitida, a última transmissão (quando e quem), as retificadas — e as ações: Transmitir (ou Desfazer) e Retificar.
// Maior e mais limpa em 30/10/2026 ("essa tela da reinf precisa ser maior e a deixe de maneira mais bonita"): a tabela ocupa
// a altura da tela e os números viraram os filtros. Refeita no mesmo dia no jeito do site (o Fiscal inteiro, como o Gmail):
// os números em cartões (ainda filtram; a linha transmitida em verde claro), a lista num .card com a busca no topo dele,
// e no celular cada empresa vira um cartão.
import { Icone, MenuSuspenso, Vazio } from '@nads/ui';
import { useReinf } from './useReinf';

export function Reinf() {
  const vm = useReinf();
  const r = vm.resumo;
  const feito = r.total ? Math.round((r.transmitidas / r.total) * 100) : 0;
  const numeros = [
    { id: 'todas', rotulo: 'Empresas', valor: r.total, icone: 'briefcase' },
    { id: 'pendentes', rotulo: 'Pendentes', valor: r.pendentes, icone: 'clock' },
    { id: 'transmitidas', rotulo: 'Transmitidas', valor: r.transmitidas, icone: 'check' },
  ] as const;
  const titulo = numeros.find(n => n.id === vm.filtro)?.rotulo || 'Empresas';
  return (
    <section className="fxr">
      <div className="tarefas-barra-topo fxr-topo">
        <MenuSuspenso icone="calendar" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
      </div>
      <div className="fxr-numeros">
        {numeros.map(n => (
          <button key={n.id} type="button" className={'fxr-numero fxr-numero-' + n.id + (vm.filtro === n.id ? ' active' : '')}
            aria-pressed={vm.filtro === n.id} onClick={() => vm.setFiltro(n.id)}>
            <span className="fxr-numero-icone"><Icone nome={n.icone} /></span>
            <span className="fxr-numero-txt">
              <span className="fxr-numero-rotulo">{n.rotulo}</span>
              <span className="fxr-numero-valor num">{n.valor}</span>
            </span>
          </button>
        ))}
        <div className="fxr-numero fxr-andamento">
          <span className="fxr-numero-txt">
            <span className="fxr-numero-rotulo">Andamento de {vm.rotuloCompetencia}</span>
            <span className="fxr-numero-valor num">{feito}%<small> · {r.transmitidas} de {r.total}</small></span>
            <span className="fxr-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={feito} aria-label={'Transmitidas: ' + feito + '%'}>
              <span style={{ width: feito + '%' }} />
            </span>
          </span>
        </div>
      </div>
      <section className="card fxr-cartao">
        <div className="fxr-cartao-topo">
          <h3 className="fxr-cartao-titulo">{titulo}</h3>
          <span className="fxr-total num">{vm.linhas.length}</span>
          <span className="tarefas-barra-espaco" />
          <label className="busca-curta fxr-busca">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar empresa" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} aria-label="Buscar empresa" />
          </label>
        </div>
        {!vm.linhas.length ? (
          <Vazio compacto icone={vm.busca ? 'search' : 'checkCircle'} titulo={vm.busca ? 'Nenhuma empresa com essa busca' : 'Nenhuma empresa com esse filtro'}
            texto={vm.filtro === 'pendentes' && !vm.busca ? 'Todas as empresas já transmitiram ' + vm.rotuloCompetencia + '.' : undefined} />
        ) : (
          <div className="fxr-rola">
            <table className="table-compact fxr-tabela fxr-reinf">
              <thead>
                <tr>
                  <th className="num">Nº</th><th>Cliente</th><th>Situação</th><th>Transmitido até</th><th>Última transmissão</th><th>Retificadas</th><th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.codigo} className={l.transmitida ? 'fxr-feita' : undefined}>
                    <td className="fxr-cod"><span className="num">{l.codigo}</span></td>
                    <td className="fxr-nome">{l.nome}</td>
                    <td className="fxr-sit-td">{l.transmitida
                      ? <span className="fxr-sit ok"><Icone nome="check" width={12} height={12} />Transmitida</span>
                      : <span className="fxr-sit">Pendente</span>}</td>
                    <td className="num fxr-ate" data-rotulo="Até">{l.ate}</td>
                    <td className="fxr-ultima" data-rotulo="Última">{l.ultima || <span className="fraco">—</span>}</td>
                    <td className="fxr-retif-td" data-rotulo="Retificadas">{l.retificadas.length
                      ? <span className="fxr-retificadas">{l.retificadas.map(x => <span key={x} className="fxr-retif num">{x}</span>)}</span>
                      : <span className="fraco">—</span>}</td>
                    <td className="fxr-acoes">
                      {l.transmitida
                        ? <button type="button" className="btn btn-sm btn-outline" onClick={() => vm.desfazer(l.codigo)} title="Desfazer a transmissão desta competência">Desfazer</button>
                        : <button type="button" className="btn btn-sm btn-primary" onClick={() => vm.transmitir(l.codigo)}><Icone nome="check" width={14} height={14} />Transmitir</button>}
                      <button type="button" className={'btn btn-sm btn-ghost' + (l.retificadaNaCompetencia ? ' fxr-retificada' : '')} onClick={() => vm.retificar(l.codigo)}
                        aria-pressed={l.retificadaNaCompetencia}
                        title={l.retificadaNaCompetencia ? 'Tirar a retificação desta competência' : 'Retificou esta competência'}>
                        {l.retificadaNaCompetencia ? 'Retificada' : 'Retificar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
