// View da REINF (Fiscal › REINF) no layout do Relatório Simples e do Presumido (Vitor, 09/11/2026: "quero igual ao empresas
// do simples nacional e lucro presumido, no mesmo layout"): em cima a competência, o Status, o Por página e a busca; embaixo
// um .card com o andamento no topo e uma linha por empresa — código, cliente, até quando foi transmitida, a última
// transmissão (quando e quem), as retificadas, as ações (Transmitir ou Desfazer, e Retificar) e a situação.
import { tarefas as t } from '@nads/core';
import { BotaoIcone, Icone, MenuSuspenso } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { useReinf } from './useReinf';

const STATUS = [{ valor: 'pendentes', rotulo: 'Pendentes' }, { valor: 'transmitidas', rotulo: 'Transmitidas' }];

export function Reinf() {
  const vm = useReinf();
  const r = vm.resumo;
  const feito = r.total ? Math.round((r.transmitidas / r.total) * 100) : 0;
  return (
    <section className="fr">
      <div className="tarefas-barra-topo fr-topo">
        <MenuSuspenso icone="calendar" className="btn btn-primary" rotulo={vm.rotuloCompetencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <MenuDeFiltro rotulo="Status" valor={vm.filtro} mudar={vm.setFiltro} opcoes={STATUS} />
        <MenuSuspenso rotulo={'Por página: ' + (vm.porPagina || 'Todas')} titulo="Empresas por página" dica="Quantas empresas por página" className="btn btn-outline"
          itens={vm.porPaginaOpcoes.map(o => ({ rotulo: o.rotulo, marcado: o.valor === vm.porPagina, onClick: () => vm.setPorPagina(o.valor) }))} />
        {(vm.filtro || vm.busca) && <button type="button" className="btn btn-ghost dp-limpar" onClick={vm.limpar}><Icone nome="x" />Limpar filtros</button>}
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta fr-busca">
          <Icone nome="search" />
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
            onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
      </div>
      <section className="card fr-cartao" aria-label="REINF">
        <div className="fr-cartao-topo">
          <span className="fr-andamento" title={r.pendentes ? r.pendentes + (r.pendentes === 1 ? ' falta' : ' faltam') + ' de ' + r.total : 'tudo feito'}>
            <span className="fr-andamento-barra" aria-hidden="true"><i style={{ width: feito + '%' }} /></span>
            <span className="fr-andamento-txt">{r.pendentes ? <><b>{r.transmitidas}</b> de {r.total} transmitidas · {r.pendentes} {r.pendentes === 1 ? 'falta' : 'faltam'}</> : <b>Todas transmitidas</b>}</span>
          </span>
          {/* a página da lista: só as setas, em cima (09/11/2026: o rodapé saiu, como no Relatório) */}
          {vm.pagina.paginas > 1 && (
            <>
              <span className="tarefas-barra-espaco" />
              <BotaoIcone pequeno icone="chevronLeft" titulo={'Página anterior (está na ' + (vm.pagina.atual + 1) + ' de ' + vm.pagina.paginas + ')'} disabled={vm.pagina.atual === 0} onClick={vm.pagina.anterior} />
              <BotaoIcone pequeno icone="chevronRight" titulo={'Próxima página (está na ' + (vm.pagina.atual + 1) + ' de ' + vm.pagina.paginas + ')'} disabled={vm.pagina.atual >= vm.pagina.paginas - 1} onClick={vm.pagina.proxima} />
            </>
          )}
        </div>
        {!vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
          <div className="fr-rola">
            <table className="fr-tabela fr-reinf">
              <colgroup>
                <col className="fr-c-cod" /><col className="fr-c-cliente" /><col className="fr-c-ate" /><col className="fr-c-ultima" /><col className="fr-c-retif" /><col className="fr-c-acoes" /><col className="fr-c-sit" />
              </colgroup>
              <thead>
                <tr>
                  <th className="fr-num">Cód.</th><th>Cliente</th><th className="fr-centro fr-g">Transmitido até</th><th className="fr-g">Última transmissão</th><th className="fr-g">Retificadas</th>
                  <th className="fr-g"><span className="sr-only">Ações</span></th><th className="fr-centro" title="Situação">Sit.</th>
                </tr>
              </thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.codigo} className={l.transmitida ? 'fr-feita' : undefined}>
                    <td className="fr-num fr-cod">{l.codigo}</td>
                    <td className="fr-cliente"><span title={l.nome}>{l.nome}</span></td>
                    <td className="fr-centro fr-g">{l.ate}</td>
                    <td className="fr-g" title={l.ultima || undefined}>{l.ultima || '—'}</td>
                    <td className="fr-g">{l.retificadas.length
                      ? <span className="fxr-retificadas">{l.retificadas.map(x => <span key={x} className="fxr-retif num">{x}</span>)}</span>
                      : '—'}</td>
                    <td className="fr-g fxr-acoes">
                      {/* as já transmitidas ficam como eram, só o Desfazer (Vitor, 12/11/2026: "as que já foram transmitidas e
                          marcadas, não mexa"); a que falta abre as séries, como o CheckList REINF do Alterdata (chamado KADMFS). O menu
                          flutua: a célula corta o que passa dela */}
                      {l.transmitida
                        ? <button type="button" className="btn btn-sm btn-outline" onClick={() => vm.desfazer(l.codigo)} title="Desfazer a transmissão desta competência">Desfazer</button>
                        : <MenuSuspenso flutuante direita largura={200} titulo={'O que foi transmitido em ' + vm.rotuloCompetencia}
                          className="btn btn-sm btn-primary" icone="check" rotulo="Transmitir" dica="Marcar o que foi transmitido"
                          itens={t.SERIES_REINF.map(s => ({ rotulo: s.rotulo, onClick: () => vm.alternarSerie(l.codigo, s.id) }))} />}
                      <button type="button" className={'btn btn-sm btn-ghost' + (l.retificadaNaCompetencia ? ' fxr-retificada' : '')} onClick={() => vm.retificar(l.codigo)}
                        aria-pressed={l.retificadaNaCompetencia}
                        title={l.retificadaNaCompetencia ? 'Tirar a retificação desta competência' : 'Retificou esta competência'}>
                        {l.retificadaNaCompetencia ? 'Retificada' : 'Retificar'}
                      </button>
                    </td>
                    <td className="fr-centro"><span className={'fr-sit' + (l.transmitida ? ' concluida' : '')} title={l.transmitida ? 'Transmitida' : 'Pendente'} aria-label={l.transmitida ? 'Transmitida' : 'Pendente'}>{l.transmitida && <Icone nome="check" width={11} height={11} />}</span></td>
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
