// Fiscal › Relatório Simples / Relatório Presumido (28/10/2026: "monte a tabela nesse estilo do dp"; cada regime numa
// página do menu lateral; no lugar do Controle de tributos). Refeito em 30/10/2026 ("a tabela é feia e pesada"; o Fiscal
// inteiro "parecendo parte do site", como o Gmail): uma barra só em cima (a competência e os filtros em menus, à direita a
// busca, o Excel e a impressora), e a tabela num .card com o andamento no topo; linhas
// baixas, o cabeçalho e o total parados ao rolar, as conferências em bolinhas pequenas e a entrega com o logo. Os dados e
// as ações são os mesmos do useRelatorioGeral. O "Enviar guias" (03/11/2026: "A parte de gmail tem que funcionar assim como
// o envios do dp"): para quem grava, abre a janela do lote de guias (JanelaDasGuias); o robô manda e preenche a tabela.
import { tarefas as t } from '@nads/core';
import { baixarBytes, BotaoIcone, Esqueleto, Icone, Interruptor, LogoExcel, MenuSuspenso, useCarregando } from '@nads/ui';
import { useState, type CSSProperties } from 'react';
import { useColunasAjustaveis } from '../../../../../comum/ColunasAjustaveis';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { JanelaDasGuias } from './JanelaDasGuias';
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
  const [guiasAbertas, setGuiasAbertas] = useState(false);
  const feitas = vm.achadas - vm.faltam;
  // as colunas ajustáveis (09/11/2026); o cliente fica com o que sobra, e cabe tudo na tela de padrão
  const col = useColunasAjustaveis('fiscal-' + g.id, [
    { id: 'cod', padrao: 44 }, { id: 'cliente', padrao: 220 },
    ...vm.guias.map(c => ({ id: c.id, padrao: 74 })), ...g.marcas.map(m => ({ id: m.id, padrao: 32 })),
    { id: 'data', padrao: 86 }, { id: 'ent', padrao: 68 }, { id: 'sit', padrao: 36 }, { id: 'ret', padrao: 52 },
  ], 'cliente');
  return (
    <section className="fr">
      <div className="tarefas-barra-topo fr-topo">
        <MenuSuspenso icone="calendar" className="btn btn-primary" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <MenuDeFiltro rotulo="Status" valor={f.status} mudar={f.setStatus} opcoes={f.statusOpcoes} />
        <MenuDeFiltro rotulo="Pendente em" valor={f.pendenteEm} mudar={f.setPendenteEm} opcoes={f.partes} todos="Todas as partes" />
        <MenuDeFiltro rotulo="Entrega" valor={f.entrega} mudar={f.setEntrega} opcoes={f.entregas} />
        {/* quantas empresas por página (28/10/2026); a busca sempre corre todas as empresas */}
        <MenuSuspenso rotulo={'Por página: ' + (f.porPagina || 'Todas')} titulo="Empresas por página" dica="Quantas empresas por página" className="btn btn-outline"
          itens={f.porPaginaOpcoes.map(o => ({ rotulo: o.rotulo, marcado: o.valor === f.porPagina, onClick: () => f.setPorPagina(o.valor) }))} />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
        <span className="tarefas-barra-espaco" />
        {vm.podeGravar && (
          <button type="button" className="btn btn-outline" onClick={() => setGuiasAbertas(true)} title="Subir as guias do mês: o robô lê, manda por Gmail ou põe na rota do Entregas (impresso) e preenche a tabela">
            <Icone nome="envelope" width={16} height={16} />Enviar guias
          </button>
        )}
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
        <section className={'card fr-cartao fr-regime-' + regime} aria-label={g.rotulo}>
          <div className="fr-cartao-topo">
            {/* o andamento: quantas das empresas achadas já estão concluídas */}
            <span className="fr-andamento" title={vm.faltam ? vm.faltam + (vm.faltam === 1 ? ' falta' : ' faltam') + ' de ' + vm.achadas : 'tudo feito'}>
              <span className="fr-andamento-barra" aria-hidden="true"><i style={{ width: (vm.achadas ? Math.round((feitas / vm.achadas) * 100) : 0) + '%' }} /></span>
              <span className="fr-andamento-txt">{vm.faltam ? <><b>{feitas}</b> de {vm.achadas} concluídas · {vm.faltam} {vm.faltam === 1 ? 'falta' : 'faltam'}</> : <b>Tudo feito</b>}</span>
            </span>
            <span className="tarefas-barra-espaco" />
            {/* a página da lista: só as setas, em cima da Entrega (09/11/2026: o rodapé saiu) */}
            {vm.pagina.paginas > 1 && (
              <>
                <BotaoIcone pequeno icone="chevronLeft" titulo={'Página anterior (está na ' + (vm.pagina.atual + 1) + ' de ' + vm.pagina.paginas + ')'} disabled={vm.pagina.atual === 0} onClick={vm.pagina.anterior} />
                <BotaoIcone pequeno icone="chevronRight" titulo={'Próxima página (está na ' + (vm.pagina.atual + 1) + ' de ' + vm.pagina.paginas + ')'} disabled={vm.pagina.atual >= vm.pagina.paginas - 1} onClick={vm.pagina.proxima} />
              </>
            )}
          </div>
          {!vm.total ? <p className="hint dp-vazio">Nenhuma empresa do {g.rotulo} no Cadastro: as empresas entram pelo regime.</p>
            : !vm.linhas.length ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              // a caixa que rola: o cabeçalho fica parado em cima
              <div className="fr-rola">
                <table className={'fr-tabela fr-grupo-' + g.id} style={{ ...col.tabela, '--fr-cod': col.largura('cod') + 'px' } as CSSProperties}>
                  <colgroup>
                    <col className="fr-c-cod" style={col.col('cod')} /><col className="fr-c-cliente" style={col.col('cliente')} />
                    {vm.guias.map(c => <col key={c.id} className="fr-c-guia" style={col.col(c.id)} />)}
                    {g.marcas.map(m => <col key={m.id} className="fr-c-mk" style={col.col(m.id)} />)}
                    <col className="fr-c-data" style={col.col('data')} /><col className="fr-c-ent" style={col.col('ent')} /><col className="fr-c-sit" style={col.col('sit')} /><col className="fr-c-ret" style={col.col('ret')} />
                  </colgroup>
                  <thead>
                    <tr className="fr-grupos">
                      <th rowSpan={2} className="fr-num fr-cabeca">Cód.{col.alca('cod')}</th><th rowSpan={2} className="fr-cabeca">Cliente{col.alca('cliente')}</th>
                      <th colSpan={vm.guias.length} className="fr-g fr-centro">Guias (R$)</th>
                      <th colSpan={g.marcas.length} className="fr-g fr-centro">Conferências</th>
                      <th colSpan={3} className="fr-g fr-centro">Entrega</th>
                      <th rowSpan={2} className="fr-g fr-centro fr-cabeca" title="A empresa foi retificada neste mês: ligada, entra no quadro de Retificação do protocolo">Retif.{col.alca('ret')}</th>
                    </tr>
                    <tr>
                      {vm.guias.map((c, i) => <th key={c.id} className={'fr-num' + (i === 0 ? ' fr-g' : '')} title={c.nome}>{c.rotulo}{col.alca(c.id)}</th>)}
                      {g.marcas.map((m, i) => <th key={m.id} className={'fr-centro' + (i === 0 ? ' fr-g' : '')} title={m.dica}>{m.rotulo}{col.alca(m.id)}</th>)}
                      <th className="fr-centro fr-g">Data{col.alca('data')}</th><th className="fr-centro">Entregue{col.alca('ent')}</th><th className="fr-centro" title="Situação">Sit.{col.alca('sit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.linhas.map(r => (
                      <tr key={r.codigo} className={r.situacao === 'concluida' ? 'fr-feita' : undefined}>
                        <td className="fr-num fr-cod">{r.codigo}</td>
                        <td className="fr-cliente"><span title={r.nome}>{r.nome}</span></td>
                        {vm.guias.map((c, i) => (
                          <td key={c.id} className={i === 0 ? 'fr-g' : undefined}>
                            <Valor estreito zeroComoTraco valor={r.linha.valores[c.id] || ''} rotulo={c.nome + ' de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarValor(r.codigo, c.id, v)} />
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
                          <Valor estreito valor={dataBr(r.linha.data)} molde="dd/mm/aaaa" rotulo={'Data de ' + r.nome} pode={vm.podeGravar} aoSalvar={v => vm.mudarData(r.codigo, v)} />
                        </td>
                        <td className="fr-centro"><Entrega valor={r.linha.entregue} pode={vm.podeGravar} rotulo={'Entrega de ' + r.nome} aoMudar={e => vm.mudarEntrega(r.codigo, e)} /></td>
                        <td className="fr-centro"><span className={'fr-sit ' + r.situacao} title={r.rotuloSituacao} aria-label={r.rotuloSituacao}>{r.situacao === 'concluida' && <Icone nome="check" width={11} height={11} />}</span></td>
                        <td className="fr-g fr-centro fr-retif">
                          {vm.podeGravar
                            ? <Interruptor ligado={t.linhaRetificada(r.linha)} onMudar={() => vm.alternarRetificacao(r.codigo)} rotulo={'Retificação de ' + r.nome} />
                            : (t.linhaRetificada(r.linha) ? 'Sim' : '–')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      )}
      {guiasAbertas && <JanelaDasGuias regime={regime} competencia={vm.competencia} fechar={() => setGuiasAbertas(false)} />}
    </section>
  );
}
