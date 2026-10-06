// O Painel do DP (Vitor, 06/10/2026: o Checklist Folha no visual do nads): a competência e os filtros em cima; os números
// do mês; as barras por responsável, enquadramento e movimento; o progresso de cada responsável; e a lista dos clientes
// com as obrigações do mês (– não tem, vazio a fazer, ✓ feita, ! parada). Tudo roda aqui: clicar na bolinha marca a
// obrigação como feita, clicar de novo desfaz (sem o checklist).
import { Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { Fragment } from 'react';
import { usePainelDoDp, type Agrupar, type EstadoDaObrigacao } from './usePainelDoDp';

const MARCA: Record<EstadoDaObrigacao, { simbolo: string; dica: string }> = {
  'nao-tem': { simbolo: '–', dica: 'não tem no mês' },
  'a-fazer': { simbolo: '', dica: 'a fazer' },
  feita: { simbolo: '✓', dica: 'feita' },
  parada: { simbolo: '!', dica: 'parada' },
};

const AGRUPAR: { valor: Agrupar; rotulo: string }[] = [{ valor: 'nenhum', rotulo: 'Nenhum' }, { valor: 'responsavel', rotulo: 'Responsável' }, { valor: 'agrupamento', rotulo: 'Agrupamento' }];

function Selecao({ rotulo, valor, mudar, opcoes }: { rotulo: string; valor: string; mudar: (v: string) => void; opcoes: readonly string[] }) {
  return (
    <label className="field dp-filtro">
      <span className="hint">{rotulo}</span>
      <select className="select-compact" value={valor} onChange={e => mudar(e.target.value)}>
        <option value="">Todos</option>
        {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export function PainelDoDp() {
  const vm = usePainelDoDp();
  const f = vm.filtros;
  useCarregando(vm.carregando);
  return (
    <section className="dp-painel">
      <div className="tarefas-filtros dp-filtros">
        <label className="field dp-filtro">
          <span className="hint">Competência</span>
          <select className="select-compact" value={vm.competencia} onChange={e => vm.setCompetencia(e.target.value)}>
            {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </label>
        <label className="field dp-filtro dp-busca">
          <span className="hint">Buscar cliente</span>
          <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Nome ou código" aria-label="Buscar cliente (nome ou código)" />
        </label>
        <Selecao rotulo="Responsável" valor={f.responsavel} mudar={f.setResponsavel} opcoes={f.responsaveis} />
        <Selecao rotulo="Movimento" valor={f.movimento} mudar={f.setMovimento} opcoes={f.movimentos} />
        <Selecao rotulo="Enquadramento" valor={f.enquadramento} mudar={f.setEnquadramento} opcoes={f.enquadramentos} />
        <label className="field dp-filtro">
          <span className="hint">Status</span>
          <select className="select-compact" value={f.status} onChange={e => f.setStatus(e.target.value as typeof f.status)}>
            <option value="">Todos</option><option value="concluidas">Concluídos</option><option value="pendentes">Pendentes</option>
          </select>
        </label>
        <Selecao rotulo="Agrupamento" valor={f.agrupamento} mudar={f.setAgrupamento} opcoes={f.agrupamentos} />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
      </div>

      {vm.carregando ? <Esqueleto numeros={4} linhas={6} /> : (
        <>
          <div className="stat-grid dp-numeros">
            {vm.numeros.map(n => (
              <div key={n.rotulo} className="stat">
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value">{n.valor}</p>
                {n.dica && <p className="hint dp-numero-dica">{n.dica}</p>}
              </div>
            ))}
          </div>

          <div className="dp-graficos">
            {vm.barras.map(g => {
              const max = Math.max(...g.linhas.map(l => l.qtd), 0);
              return (
                <section key={g.titulo} className="card dp-grafico">
                  <h3 className="dp-titulo">{g.titulo}</h3>
                  <ul className="dp-barras">
                    {g.linhas.map(l => (
                      <li key={l.rotulo} title={l.rotulo + ': ' + l.qtd + (l.qtd === 1 ? ' cliente' : ' clientes')}>
                        <span className="dp-barra-rotulo">{l.rotulo}</span>
                        <span className="dp-barra"><span style={{ width: max ? (l.qtd / max) * 100 + '%' : 0 }} /></span>
                        <b className="num">{l.qtd}</b>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>

          <section className="card dp-progresso">
            <h3 className="dp-titulo">Progresso por responsável</h3>
            <div className="dp-progresso-grade">
              {vm.progresso.map(p => (
                <button key={p.nome} type="button" className={'dp-pessoa' + (f.responsavel === p.nome ? ' ativa' : '')}
                  onClick={() => f.setResponsavel(f.responsavel === p.nome ? '' : p.nome)} title={'Filtrar a lista: ' + p.nome}>
                  <span className="dp-pessoa-topo"><b>{p.nome}</b><span className="num">{p.feitos}/{p.total}</span></span>
                  <span className="dp-pessoa-barra"><span style={{ width: p.pct + '%' }} /></span>
                  <span className="hint">{p.pct}% concluído{p.parados ? ' · ' + p.parados + (p.parados === 1 ? ' parada' : ' paradas') : ''}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="card dp-lista">
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">Clientes</h3>
              <span className="badge badge-neutral">{vm.quantas}</span>
              <span className="tarefas-barra-espaco" />
              <span className="hint">Agrupar por</span>
              <Segmentado valor={f.agrupar} opcoes={AGRUPAR} onMudar={f.setAgrupar} />
            </div>
            {vm.quantas === 0 ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              <div className="table-wrap">
                <table className="dp-tabela">
                  <thead>
                    <tr className="dp-cabeca-grupo">
                      <th colSpan={3} />
                      <th colSpan={vm.colunas.length} className="dp-ob-grupo">Obrigações do mês</th>
                      <th />
                    </tr>
                    <tr>
                      <th>Cód.</th><th>Cliente</th><th>Responsável</th>
                      {vm.colunas.map((o, i) => <th key={o.id} className={'dp-ob' + (i === 0 ? ' dp-ob-primeira' : '')} title={o.nome}>{o.rotulo}</th>)}
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.grupos.map(g => (
                      <Fragment key={g.nome || 'todos'}>
                        {g.nome && <tr className="dp-grupo"><td colSpan={4 + vm.colunas.length}>{g.nome} <span className="hint">{g.feitas}/{g.linhas.length} concluídos</span></td></tr>}
                        {g.linhas.map(c => (
                          <tr key={c.chave} className={'dp-linha' + (c.concluida ? ' feita' : '')}>
                            <td className="num fraco">{c.codigo}</td>
                            {/* o enquadramento, o movimento, a REINF e a entrega embaixo do nome (a tabela cabe sem rolar de lado) */}
                            <td className="dp-cliente">
                              <span className="dp-cliente-nome">{c.nomeNaTela}</span>
                              <span className="dp-cliente-info">{[c.enquadramento, c.movimento, c.reinfAutorizada ? 'REINF autorizada' : '', c.entrega].filter(Boolean).join(' · ')}</span>
                            </td>
                            <td>{c.responsavel ? c.responsavelNome : <span className="fraco">—</span>}</td>
                            {c.obrigacoes.map((o, i) => (
                              <td key={o.id} className={'dp-ob' + (i === 0 ? ' dp-ob-primeira' : '')}>
                                {o.estado === 'nao-tem' ? <span className="dp-marca nao-tem" title="não tem no mês">–</span> : (
                                  <button type="button" className={'dp-marca ' + o.estado} disabled={vm.carregando} onClick={() => vm.alternar(c.codigo, o.etapa)}
                                    title={(vm.colunas.find(x => x.id === o.id)?.nome || '') + ': ' + (o.estado === 'feita' ? 'feita por ' + o.quem + ' (clique para desfazer)' : 'clique quando fizer')}
                                    aria-label={(vm.colunas.find(x => x.id === o.id)?.nome || '') + ' de ' + c.nomeNaTela + (o.estado === 'feita' ? ': feita' : ': a fazer')} aria-pressed={o.estado === 'feita'}>
                                    {MARCA[o.estado].simbolo}
                                  </button>
                                )}
                              </td>
                            ))}
                            <td><span className={'badge ' + (c.concluida ? 'badge-ok' : c.parada ? 'badge-warn' : 'badge-neutral')}>{c.situacao}</span></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
