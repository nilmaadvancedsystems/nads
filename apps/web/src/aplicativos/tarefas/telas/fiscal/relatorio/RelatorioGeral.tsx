// Fiscal › Relatório geral (28/10/2026: "monte a tabela nesse estilo do dp"): a barra das Obrigações do DP (a competência,
// a busca e os filtros em menus) e o cartão com a tabela de colunas agrupadas — as guias do Simples e do Lucro Presumido,
// o parcelamento, a REINF e a entrega — com a mesma bolinha do DP (– não tem, vazio a fazer, ✓ feita). Só peças que
// já existem (MenuSuspenso, MenuDeFiltro, busca-curta, Segmentado, a tabela do DP).
import { baixarBytes, Esqueleto, Icone, MenuSuspenso, Segmentado, useCarregando } from '@nads/ui';
import { Fragment } from 'react';
import { MenuDeFiltro } from '../../dp/MenuDeFiltro';
import { useRelatorioGeral, type Casa } from './useRelatorioGeral';

const SIMBOLO = { 'nao-tem': '–', 'a-fazer': '', feita: '✓' } as const;
const AGRUPAR = [{ valor: 'nenhum' as const, rotulo: 'Nenhum' }, { valor: 'regime' as const, rotulo: 'Regime' }];

function Bolinha({ c, nome, pode, clicar }: { c: Casa; nome: string; pode: boolean; clicar: () => void }) {
  const ativa = c.acao !== 'ver' && pode;
  if (!ativa) return <span className={'dp-marca' + (c.acao === 'ver' ? ' leitura' : '') + ' ' + c.estado} title={c.dica} aria-label={nome + ': ' + c.dica}>{SIMBOLO[c.estado]}</span>;
  return (
    <button type="button" className={'dp-marca ' + c.estado} onClick={clicar} title={c.dica} aria-label={nome + ': ' + c.dica} aria-pressed={c.estado === 'feita'}>
      {SIMBOLO[c.estado]}
    </button>
  );
}

export function RelatorioGeral() {
  const vm = useRelatorioGeral();
  const f = vm.filtros;
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel rel-geral">
      <div className="tarefas-barra-topo dp-filtros-linha">
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
            onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
        </label>
        <MenuDeFiltro rotulo="Enquadramento" valor={f.enquadramento} mudar={f.setEnquadramento} opcoes={f.enquadramentos} />
        <MenuDeFiltro rotulo="Status" valor={f.status} mudar={f.setStatus} opcoes={f.statusOpcoes} />
        <MenuDeFiltro rotulo="Pendente em" valor={f.pendenteEm} mudar={f.setPendenteEm} opcoes={f.partes} todos="Todas as partes" />
        <MenuDeFiltro rotulo="Entrega" valor={f.entrega} mudar={f.setEntrega} opcoes={f.entregas} direita />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: o que se marca fica só nesta aba.</p>}

      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <section className="card dp-lista">
          <div className="dp-lista-topo">
            <h3 className="dp-titulo">Relatório geral</h3>
            <span className="badge badge-neutral">{vm.quantas}</span>
            {vm.faltam > 0 ? <span className="hint">{vm.faltam} {vm.faltam === 1 ? 'falta' : 'faltam'}</span> : <span className="hint">tudo feito</span>}
            <span className="tarefas-barra-espaco" />
            <button type="button" className="btn btn-outline" disabled={!vm.quantas}
              onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
              <Icone nome="download" />Exportar Excel
            </button>
            <span className="hint">Agrupar por</span>
            <Segmentado valor={f.agrupar} opcoes={AGRUPAR} onMudar={f.setAgrupar} />
          </div>
          {!vm.quantas ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
            <div className="table-wrap">
              <table className="dp-tabela">
                <thead>
                  <tr className="dp-cabeca-grupo">
                    <th colSpan={2} />
                    {vm.partes.map(p => <th key={p.id} colSpan={p.colunas.length} className="dp-ob-grupo dp-ob-primeira">{p.rotulo}</th>)}
                    <th colSpan={2} />
                  </tr>
                  <tr>
                    <th>Cód.</th><th>Cliente</th>
                    {vm.colunas.map(c => <th key={c.id} className={'dp-ob' + (vm.primeiras.has(c.id) ? ' dp-ob-primeira' : '')} title={c.nome}>{c.rotulo}</th>)}
                    <th className="dp-onde">Onde</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {vm.grupos.map(g => (
                    <Fragment key={g.nome || 'todos'}>
                      {g.nome && <tr className="dp-grupo"><td colSpan={4 + vm.colunas.length}>{g.nome} <span className="hint">{g.linhas.filter(r => r.situacao === 'concluida').length}/{g.linhas.length} concluídos</span></td></tr>}
                      {g.linhas.map(r => (
                        <tr key={r.codigo} className={'dp-linha' + (r.situacao === 'concluida' ? ' feita' : '')}>
                          <td className="num fraco">{r.codigo}</td>
                          <td className="dp-cliente"><span className="dp-cliente-nome" title={r.nome + ' · ' + r.regime}>{r.nome}</span></td>
                          {r.casas.map(c => (
                            <td key={c.id} className={'dp-ob' + (vm.primeiras.has(c.id) ? ' dp-ob-primeira' : '')}>
                              <Bolinha c={c} nome={(vm.colunas.find(x => x.id === c.id)?.nome || '') + ' de ' + r.nome} pode={c.acao === 'marca' ? vm.podeGravar : true} clicar={() => vm.clicar(r.codigo, c)} />
                            </td>
                          ))}
                          <td className="dp-onde fraco">{r.onde || '—'}</td>
                          <td><span className={'badge ' + (r.situacao === 'concluida' ? 'badge-ok' : r.situacao === 'em-andamento' ? 'badge-warn' : 'badge-neutral')}>{r.rotuloSituacao}</span></td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint dp-vazio">Os valores das guias e a entrega se escrevem no Controle de tributos; aqui a bolinha mostra se já tem. A REINF transmite como na tela da REINF.</p>
        </section>
      )}
    </section>
  );
}
