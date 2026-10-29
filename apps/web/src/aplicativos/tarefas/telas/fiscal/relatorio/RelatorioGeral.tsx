// Fiscal › Relatório Simples / Relatório Presumido (28/10/2026: "monte a tabela nesse estilo do dp"; cada regime numa
// página do menu lateral; no lugar do Controle de tributos): a barra das Obrigações do DP (a competência e os filtros em
// menus), em cima da tabela a busca, o Excel e a impressora do protocolo; a tabela com as colunas agrupadas — as guias com
// o valor em reais, as conferências na bolinha do DP (o R é a REINF: saiu a coluna da REINF, 29/10/2026), a data e a
// entrega — e o total. As Observações e a
// Retificação saíram por enquanto (28/10/2026). Só peças que já existem.
import { baixarBytes, BotaoIcone, Esqueleto, Icone, LogoExcel, MenuSuspenso, useCarregando } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { Entrega, Valor } from './PartesDoRelatorio';
import { dataBr, useRelatorioGeral, type RegimeDoRelatorio } from './useRelatorioGeral';

/** A bolinha do DP: – não tem, vazia a fazer, ✓ feita; clicável quando pode. */
function Bolinha({ estado, dica, pode, clicar }: { estado: 'nao-tem' | 'a-fazer' | 'feita'; dica: string; pode: boolean; clicar?: () => void }) {
  const simbolo = estado === 'feita' ? '✓' : estado === 'nao-tem' ? '–' : '';
  if (!pode || !clicar) return <span className={'dp-marca ' + estado} title={dica} aria-label={dica}>{simbolo}</span>;
  return <button type="button" className={'dp-marca ' + estado} onClick={clicar} title={dica} aria-label={dica} aria-pressed={estado === 'feita'}>{simbolo}</button>;
}

export function RelatorioGeral({ regime }: { regime: RegimeDoRelatorio }) {
  const vm = useRelatorioGeral(regime);
  const f = vm.filtros;
  const g = vm.grupo;
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel rel-geral">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <MenuDeFiltro rotulo="Status" valor={f.status} mudar={f.setStatus} opcoes={f.statusOpcoes} />
        <MenuDeFiltro rotulo="Pendente em" valor={f.pendenteEm} mudar={f.setPendenteEm} opcoes={f.partes} todos="Todas as partes" />
        <MenuDeFiltro rotulo="Entrega" valor={f.entrega} mudar={f.setEntrega} opcoes={f.entregas} />
        {/* quantas empresas por página (28/10/2026); a busca sempre corre todas as empresas */}
        <MenuSuspenso rotulo={'Por página: ' + (f.porPagina || 'Todas')} titulo="Empresas por página" dica="Quantas empresas por página" className="btn btn-outline"
          itens={f.porPaginaOpcoes.map(o => ({ rotulo: o.rotulo, marcado: o.valor === f.porPagina, onClick: () => f.setPorPagina(o.valor) }))} />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: o que se escreve fica só nesta aba.</p>}
      {!vm.podeGravar && <p className="hint">Só o Fiscal preenche o relatório; você está vendo.</p>}

      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <>
          {/* o topo da tabela como o das Obrigações do DP: à direita, a busca e os botões só com o ícone */}
          <div className="tarefas-barra-topo dp-filtros-linha">
            {vm.podeGravar && vm.comSugestaoParaUsar > 0 && (
              <button type="button" className="btn btn-outline" onClick={() => void vm.usarSugestoes()} title="Passa o que o Entregas já entregou para os campos em branco">
                <Icone nome="download" />Preencher com o Entregas ({vm.comSugestaoParaUsar})
              </button>
            )}
            <span className="hint">{vm.faltam ? vm.faltam + (vm.faltam === 1 ? ' falta' : ' faltam') + ' de ' + vm.achadas : 'tudo feito'}</span>
            <span className="tarefas-barra-espaco" />
            <label className="busca-curta">
              <Icone nome="search" />
              <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
                onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
            </label>
            <button type="button" className="icon-btn" title="Exportar a tabela para o Excel" aria-label="Exportar a tabela para o Excel" disabled={!vm.linhas.length}
              onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
              <LogoExcel />
            </button>
            <BotaoIcone icone="printer" titulo="Imprimir o protocolo de entrega" onClick={vm.imprimir} />
          </div>
          <section className="card dp-lista">
            {!vm.total ? <p className="hint dp-vazio">Nenhuma empresa do {g.rotulo} no Cadastro: as empresas entram pelo regime.</p>
              : !vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
                <div className="table-wrap">
                  <table className="dp-tabela rel-tabela">
                    {/* as larguras das colunas (o cabeçalho tem duas linhas: a tabela fixa lê as larguras daqui); o cliente fica com o resto */}
                    <colgroup>
                      <col className="rel-cod" /><col />
                      {vm.guias.map(c => <col key={c.id} className="rel-guia" />)}
                      {g.marcas.map(m => <col key={m.id} className="rel-mk" />)}
                      <col className="rel-data" /><col className="rel-ent" /><col className="rel-sit" />
                    </colgroup>
                    <thead>
                      <tr className="dp-cabeca-grupo">
                        <th colSpan={2} />
                        <th colSpan={vm.guias.length} className="dp-ob-grupo dp-ob-primeira">Guias (R$)</th>
                        <th colSpan={g.marcas.length} className="dp-ob-grupo dp-ob-primeira">Conferências</th>
                        <th colSpan={2} className="dp-ob-grupo dp-ob-primeira">Entrega</th>
                        <th />
                      </tr>
                      <tr>
                        <th className="rel-cod">Cód.</th><th>Cliente</th>
                        {vm.guias.map((c, i) => <th key={c.id} className={'dp-ob rel-guia' + (i === 0 ? ' dp-ob-primeira' : '')} title={c.nome}>{c.rotulo}</th>)}
                        {g.marcas.map((m, i) => <th key={m.id} className={'dp-ob' + (i === 0 ? ' dp-ob-primeira' : '')} title={m.dica}>{m.rotulo}</th>)}
                        <th className="dp-ob dp-ob-primeira rel-data">Data</th><th className="dp-ob rel-ent">Entregue</th>
                        <th className="dp-ob rel-sit" title="Situação">Sit.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vm.linhas.map(r => (
                        <tr key={r.codigo} className={'dp-linha' + (r.situacao === 'concluida' ? ' feita' : '')}>
                          <td className="num fraco">{r.codigo}</td>
                          <td className="dp-cliente"><span className="dp-cliente-nome" title={r.nome}>{r.nome}</span></td>
                          {vm.guias.map((c, i) => (
                            <td key={c.id} className={'num rel-guia' + (i === 0 ? ' dp-ob-primeira' : '')}>
                              <Valor estreito valor={r.linha.valores[c.id] || ''} sugestao={r.sugestao?.valores[c.id]} rotulo={c.nome + ' de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarValor(r.codigo, c.id, v)} />
                            </td>
                          ))}
                          {g.marcas.map((m, i) => {
                            const mk = r.linha.marcas[m.id] || '';
                            return (
                              <td key={m.id} className={'dp-ob' + (i === 0 ? ' dp-ob-primeira' : '')}>
                                <Bolinha estado={mk === 'ok' ? 'feita' : mk === 'na' ? 'nao-tem' : 'a-fazer'} pode={vm.podeGravar} clicar={() => vm.virarMarca(r.codigo, m.id)}
                                  dica={m.dica + ' de ' + r.nome + ': ' + (mk === 'ok' ? 'conferido' : mk === 'na' ? 'não se aplica' : 'falta') + ' (clique: OK → não se aplica → em branco)'} />
                              </td>
                            );
                          })}
                          <td className="dp-ob dp-ob-primeira rel-data">
                            <Valor estreito valor={dataBr(r.linha.data)} sugestao={r.sugestao?.data ? dataBr(r.sugestao.data) : 'dd/mm/aaaa'} rotulo={'Data de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarData(r.codigo, v)} />
                          </td>
                          <td className="dp-ob rel-ent"><Entrega valor={r.linha.entregue} pode={vm.podeGravar} rotulo={'Entrega de ' + r.nome} aoMudar={e => vm.mudarEntrega(r.codigo, e)} /></td>
                          <td className="dp-ob rel-sit"><span className={'dp-marca ' + (r.situacao === 'concluida' ? 'feita' : r.situacao === 'em-andamento' ? 'parada' : 'a-fazer')} title={r.rotuloSituacao} aria-label={r.rotuloSituacao}>{r.situacao === 'concluida' ? '✓' : r.situacao === 'em-andamento' ? '…' : ''}</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}><b>Total</b></td>
                        {vm.totais.map((x, i) => <td key={x.id} className={'num' + (i === 0 ? ' dp-ob-primeira' : '')}>{x.valor}</td>)}
                        <td colSpan={g.marcas.length + 3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
          </section>
          {vm.pagina.paginas > 1 && (
            <div className="tarefas-barra-topo dp-filtros-linha">
              <span className="tarefas-barra-espaco" />
              <span className="hint">{vm.pagina.de}–{vm.pagina.ate} de {vm.achadas} · página {vm.pagina.atual + 1} de {vm.pagina.paginas}</span>
              <button type="button" className="btn btn-outline" disabled={vm.pagina.atual === 0} onClick={vm.pagina.anterior}><Icone nome="chevronLeft" />Anterior</button>
              <button type="button" className="btn btn-outline" disabled={vm.pagina.atual >= vm.pagina.paginas - 1} onClick={vm.pagina.proxima}>Próxima<Icone nome="chevronRight" /></button>
            </div>
          )}
          <p className="hint">Nos valores: o número em reais, "-" quando não tem guia ou "0". Em cinza, o que o Entregas já entregou. Nas conferências: clique para OK, de novo para "não se aplica" (–) e de novo para limpar.</p>
        </>
      )}
    </section>
  );
}
