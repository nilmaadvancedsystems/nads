// Fiscal › Relatório Simples / Relatório Presumido (28/10/2026: "monte a tabela nesse estilo do dp"; cada regime numa
// página do menu lateral; no lugar do Controle de tributos): a barra das Obrigações do DP (a competência e os filtros em
// menus), em cima da tabela a busca, o Excel e a impressora do protocolo; a tabela com as colunas agrupadas — as guias com
// o valor em reais, as conferências e a REINF na bolinha do DP, a data e a entrega — e o total; embaixo, as Observações e
// a Retificação. Só peças que já existem.
import { baixarBytes, BotaoIcone, Esqueleto, Icone, LogoExcel, MenuSuspenso, useCarregando } from '@nads/ui';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { Entrega, Observacoes, Retificacao, Valor } from './PartesDoRelatorio';
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
            <span className="hint">{vm.faltam ? vm.faltam + (vm.faltam === 1 ? ' falta' : ' faltam') + ' de ' + vm.linhas.length : 'tudo feito'}</span>
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
                  <table className="dp-tabela">
                    <thead>
                      <tr className="dp-cabeca-grupo">
                        <th colSpan={2} />
                        <th colSpan={vm.guias.length} className="dp-ob-grupo dp-ob-primeira">Guias (R$)</th>
                        <th colSpan={g.marcas.length} className="dp-ob-grupo dp-ob-primeira">Conferências</th>
                        <th colSpan={2} className="dp-ob-grupo dp-ob-primeira">REINF</th>
                        <th colSpan={2} className="dp-ob-grupo dp-ob-primeira">Entrega</th>
                        <th />
                      </tr>
                      <tr>
                        <th>Cód.</th><th>Cliente</th>
                        {vm.guias.map((c, i) => <th key={c.id} className={'dp-ob' + (i === 0 ? ' dp-ob-primeira' : '')} title={c.nome}>{c.rotulo}</th>)}
                        {g.marcas.map((m, i) => <th key={m.id} className={'dp-ob' + (i === 0 ? ' dp-ob-primeira' : '')} title={m.dica}>{m.rotulo}</th>)}
                        <th className="dp-ob dp-ob-primeira" title="EFD-REINF transmitida">REINF</th><th className="dp-ob" title="REINF retificada na competência">Retif.</th>
                        <th className="dp-ob dp-ob-primeira">Data</th><th className="dp-ob">Entregue</th>
                        <th>Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vm.linhas.map(r => (
                        <tr key={r.codigo} className={'dp-linha' + (r.situacao === 'concluida' ? ' feita' : '')}>
                          <td className="num fraco">{r.codigo}</td>
                          <td className="dp-cliente"><span className="dp-cliente-nome" title={r.nome}>{r.nome}</span></td>
                          {vm.guias.map((c, i) => (
                            <td key={c.id} className={'num' + (i === 0 ? ' dp-ob-primeira' : '')}>
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
                          <td className="dp-ob dp-ob-primeira">
                            <Bolinha estado={!r.reinf.tem ? 'nao-tem' : r.reinf.transmitida ? 'feita' : 'a-fazer'} dica={r.reinf.dica} pode={r.reinf.tem} clicar={() => vm.alternarReinf(r.codigo, r.reinf.transmitida)} />
                          </td>
                          <td className="dp-ob">
                            <Bolinha estado={!r.reinf.tem ? 'nao-tem' : r.reinf.retificada ? 'feita' : 'a-fazer'} dica={r.reinf.dicaRetificar} pode={r.reinf.tem} clicar={() => vm.retificarReinf(r.codigo)} />
                          </td>
                          <td className="dp-ob dp-ob-primeira">
                            <Valor estreito valor={dataBr(r.linha.data)} sugestao={r.sugestao?.data ? dataBr(r.sugestao.data) : 'dd/mm/aaaa'} rotulo={'Data de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarData(r.codigo, v)} />
                          </td>
                          <td className="dp-ob"><Entrega valor={r.linha.entregue} pode={vm.podeGravar} rotulo={'Entrega de ' + r.nome} aoMudar={e => vm.mudarEntrega(r.codigo, e)} /></td>
                          <td><span className={'badge ' + (r.situacao === 'concluida' ? 'badge-ok' : r.situacao === 'em-andamento' ? 'badge-warn' : 'badge-neutral')}>{r.rotuloSituacao}</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}><b>Total</b></td>
                        {vm.totais.map((x, i) => <td key={x.id} className={'num' + (i === 0 ? ' dp-ob-primeira' : '')}>{x.valor}</td>)}
                        <td colSpan={g.marcas.length + 5} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
          </section>
          <p className="hint">Nos valores: o número em reais, "-" quando não tem guia ou "0". Em cinza, o que o Entregas já entregou. Nas conferências: clique para OK, de novo para "não se aplica" (–) e de novo para limpar. A REINF transmite como na tela da REINF.</p>
          <Observacoes vm={vm} />
          <Retificacao vm={vm} />
        </>
      )}
    </section>
  );
}
