// Fiscal › Relatório Simples / Relatório Presumido (28/10/2026: "monte a tabela nesse estilo do dp"; cada regime numa
// página do menu lateral; no lugar do Controle de tributos). Refeito em 30/10/2026 ("a tabela é feia e pesada"; o Fiscal
// inteiro "parecendo parte do site", como o Gmail): uma barra só em cima (a competência e os filtros em menus, à direita a
// busca, o Excel e a impressora), e a tabela num .card com o andamento e o "Preencher com o Entregas" no topo; linhas
// baixas, o cabeçalho e o total parados ao rolar, as conferências em bolinhas pequenas e a entrega com o logo. Os dados e
// as ações são os mesmos do useRelatorioGeral.
import { baixarBytes, BotaoIcone, Esqueleto, Icone, LogoExcel, MenuSuspenso, useCarregando } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { Entrega, Valor } from './PartesDoRelatorio';
import { dataBr, useRelatorioGeral, type RegimeDoRelatorio } from './useRelatorioGeral';

type EstadoDaMarca = 'nao-tem' | 'a-fazer' | 'feita';

/** A conferência: a bolinha pequena (vazia a fazer, ✓ feita, – não se aplica); clicável quando pode. */
function Bolinha({ estado, dica, pode, clicar }: { estado: EstadoDaMarca; dica: string; pode: boolean; clicar?: () => void }) {
  const conteudo = estado === 'feita' ? <Icone nome="check" width={11} height={11} /> : estado === 'nao-tem' ? '–' : null;
  if (!pode || !clicar) return <span className={'fr-marca ' + estado} title={dica} aria-label={dica}>{conteudo}</span>;
  return <button type="button" className={'fr-marca ' + estado} onClick={clicar} title={dica} aria-label={dica} aria-pressed={estado === 'feita'}>{conteudo}</button>;
}

export function RelatorioGeral({ regime }: { regime: RegimeDoRelatorio }) {
  const vm = useRelatorioGeral(regime);
  const f = vm.filtros;
  const g = vm.grupo;
  useCarregando(vm.carregando);
  const feitas = vm.achadas - vm.faltam;
  return (
    <section className="fr">
      <div className="tarefas-barra-topo fr-topo">
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <MenuDeFiltro rotulo="Status" valor={f.status} mudar={f.setStatus} opcoes={f.statusOpcoes} />
        <MenuDeFiltro rotulo="Pendente em" valor={f.pendenteEm} mudar={f.setPendenteEm} opcoes={f.partes} todos="Todas as partes" />
        <MenuDeFiltro rotulo="Entrega" valor={f.entrega} mudar={f.setEntrega} opcoes={f.entregas} />
        {/* quantas empresas por página (28/10/2026); a busca sempre corre todas as empresas */}
        <MenuSuspenso rotulo={'Por página: ' + (f.porPagina || 'Todas')} titulo="Empresas por página" dica="Quantas empresas por página" className="btn btn-outline"
          itens={f.porPaginaOpcoes.map(o => ({ rotulo: o.rotulo, marcado: o.valor === f.porPagina, onClick: () => f.setPorPagina(o.valor) }))} />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta fr-busca">
          <Icone nome="search" />
          <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
            onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
        </label>
        <button type="button" className="icon-btn" title="Exportar a tabela para o Excel" aria-label="Exportar a tabela para o Excel" disabled={vm.carregando || !vm.linhas.length}
          onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
          <LogoExcel />
        </button>
        <BotaoIcone icone="printer" titulo="Imprimir o protocolo de entrega" onClick={vm.imprimir} disabled={vm.carregando} />
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: o que se escreve fica só nesta aba.</p>}
      {!vm.podeGravar && <p className="hint">Só o Fiscal preenche o relatório; você está vendo.</p>}

      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <section className="card fr-cartao">
          <div className="fr-cartao-topo">
            <h3 className="fr-cartao-titulo">{g.rotulo}</h3>
            {/* o andamento: quantas das empresas achadas já estão concluídas */}
            <span className="fr-andamento" title={vm.faltam ? vm.faltam + (vm.faltam === 1 ? ' falta' : ' faltam') + ' de ' + vm.achadas : 'tudo feito'}>
              <span className="fr-andamento-barra" aria-hidden="true"><i style={{ width: (vm.achadas ? Math.round((feitas / vm.achadas) * 100) : 0) + '%' }} /></span>
              <span className="fr-andamento-txt">{vm.faltam ? <><b>{feitas}</b> de {vm.achadas} concluídas · {vm.faltam} {vm.faltam === 1 ? 'falta' : 'faltam'}</> : <b>Tudo feito</b>}</span>
            </span>
            <span className="tarefas-barra-espaco" />
            {vm.podeGravar && vm.comSugestaoParaUsar > 0 && (
              <button type="button" className="btn btn-outline btn-sm fr-preencher" onClick={() => void vm.usarSugestoes()} title="Passa o que o Entregas já entregou para os campos em branco">
                <Icone nome="download" />Preencher com o Entregas<span className="fr-qtd">{vm.comSugestaoParaUsar}</span>
              </button>
            )}
          </div>
          {!vm.total ? <p className="hint dp-vazio">Nenhuma empresa do {g.rotulo} no Cadastro: as empresas entram pelo regime.</p>
            : !vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              // a caixa que rola: o cabeçalho fica parado em cima e o total embaixo
              <div className="fr-rola">
                <table className="fr-tabela">
                  <colgroup>
                    <col className="fr-c-cod" /><col className="fr-c-cliente" />
                    {vm.guias.map(c => <col key={c.id} className="fr-c-guia" />)}
                    {g.marcas.map(m => <col key={m.id} className="fr-c-mk" />)}
                    <col className="fr-c-data" /><col className="fr-c-ent" /><col className="fr-c-sit" />
                  </colgroup>
                  <thead>
                    <tr className="fr-grupos">
                      <th colSpan={2} />
                      <th colSpan={vm.guias.length} className="fr-g">Guias (R$)</th>
                      <th colSpan={g.marcas.length} className="fr-g fr-centro">Conferências</th>
                      <th colSpan={3} className="fr-g">Entrega</th>
                    </tr>
                    <tr>
                      <th className="fr-num">Cód.</th><th>Cliente</th>
                      {vm.guias.map((c, i) => <th key={c.id} className={'fr-num' + (i === 0 ? ' fr-g' : '')} title={c.nome}>{c.rotulo}</th>)}
                      {g.marcas.map((m, i) => <th key={m.id} className={'fr-centro' + (i === 0 ? ' fr-g' : '')} title={m.dica}>{m.rotulo}</th>)}
                      <th className="fr-centro fr-g">Data</th><th className="fr-centro">Entregue</th><th className="fr-centro" title="Situação">Sit.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(r => (
                      <tr key={r.codigo} className={r.situacao === 'concluida' ? 'fr-feita' : undefined}>
                        <td className="fr-num fr-cod">{r.codigo}</td>
                        <td className="fr-cliente"><span title={r.nome}>{r.nome}</span></td>
                        {vm.guias.map((c, i) => (
                          <td key={c.id} className={i === 0 ? 'fr-g' : undefined}>
                            <Valor estreito valor={r.linha.valores[c.id] || ''} sugestao={r.sugestao?.valores[c.id]} rotulo={c.nome + ' de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarValor(r.codigo, c.id, v)} />
                          </td>
                        ))}
                        {g.marcas.map((m, i) => {
                          const mk = r.linha.marcas[m.id] || '';
                          return (
                            <td key={m.id} className={'fr-centro' + (i === 0 ? ' fr-g' : '')}>
                              <Bolinha estado={mk === 'ok' ? 'feita' : mk === 'na' ? 'nao-tem' : 'a-fazer'} pode={vm.podeGravar} clicar={() => vm.virarMarca(r.codigo, m.id)}
                                dica={m.dica + ' de ' + r.nome + ': ' + (mk === 'ok' ? 'conferido' : mk === 'na' ? 'não se aplica' : 'falta') + ' (clique: OK → não se aplica → em branco)'} />
                            </td>
                          );
                        })}
                        <td className="fr-g fr-data">
                          <Valor estreito valor={dataBr(r.linha.data)} sugestao={r.sugestao?.data ? dataBr(r.sugestao.data) : undefined} molde="dd/mm/aaaa" rotulo={'Data de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarData(r.codigo, v)} />
                        </td>
                        <td className="fr-centro"><Entrega valor={r.linha.entregue} pode={vm.podeGravar} rotulo={'Entrega de ' + r.nome} aoMudar={e => vm.mudarEntrega(r.codigo, e)} /></td>
                        <td className="fr-centro"><span className={'fr-sit ' + r.situacao} title={r.rotuloSituacao} aria-label={r.rotuloSituacao}>{r.situacao === 'concluida' && <Icone nome="check" width={11} height={11} />}</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2}>Total <span className="fr-total-qtd">{vm.achadas} {vm.achadas === 1 ? 'empresa' : 'empresas'}</span></td>
                      {vm.totais.map((x, i) => <td key={x.id} className={'fr-num' + (i === 0 ? ' fr-g' : '') + (x.valor === '—' ? ' fr-zero' : '')} title={x.valor === '—' ? undefined : 'R$ ' + x.valor}>{x.valor}</td>)}
                      <td colSpan={g.marcas.length + 3} className="fr-g" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          {vm.pagina.paginas > 1 && (
            <div className="fr-cartao-pe">
              <span className="hint">{vm.pagina.de}–{vm.pagina.ate} de {vm.achadas} · página {vm.pagina.atual + 1} de {vm.pagina.paginas}</span>
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-outline btn-sm" disabled={vm.pagina.atual === 0} onClick={vm.pagina.anterior}><Icone nome="chevronLeft" />Anterior</button>
              <button type="button" className="btn btn-outline btn-sm" disabled={vm.pagina.atual >= vm.pagina.paginas - 1} onClick={vm.pagina.proxima}>Próxima<Icone nome="chevronRight" /></button>
            </div>
          )}
        </section>
      )}
      <p className="hint fr-legenda">Nos valores: o número em reais, "-" quando não tem guia ou "0". Em cinza, o que o Entregas já entregou. Nas conferências: clique para OK, de novo para "não se aplica" (–) e de novo para limpar.</p>
    </section>
  );
}
