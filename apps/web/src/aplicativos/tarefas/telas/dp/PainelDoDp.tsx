// O Painel do DP (Vitor, 06/10/2026: o Checklist Folha no visual do nads), uma página por aba do alto (Resumo, Folha,
// eSocial, Guias, Entrega): a competência e os filtros em cima; no Resumo, os números
// do mês; as barras por responsável, enquadramento e movimento; o progresso de cada responsável; e a lista dos clientes
// com as obrigações do mês (– não tem, vazio a fazer, ✓ feita, ! parada). Tudo roda aqui: clicar na bolinha marca a
// obrigação como feita, clicar de novo desfaz (sem o checklist).
import { formatos } from '@nads/core';
import { Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { Fragment, useState } from 'react';
import { usePainelDoDp, type AbaDoPainel, type Agrupar, type EstadoDaObrigacao } from './usePainelDoDp';

/**
 * O total da folha do mês na linha do cliente (Vitor, 07/10/2026: "trazer quanto é gasto em folha do DP"): mostra o valor
 * (ou "Informar"); um clique abre o campo; Enter grava, Esc desiste. O Fiscal vê ao lado do faturamento.
 */
function FolhaNaLinha({ valor, informar, travado }: { valor: number | null; informar: (v: number) => void; travado: boolean }) {
  const [texto, setTexto] = useState<string | null>(null);
  if (texto == null) {
    return (
      <button type="button" className="btn btn-ghost dp-folha" disabled={travado} title="O total da folha do mês (salários, pró-labore e encargos)"
        onClick={() => setTexto(valor != null ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')}>
        {valor != null ? <span className="num">{formatos.reais(valor)}</span> : <span className="fraco">Informar</span>}
      </button>
    );
  }
  const gravar = () => {
    const v = Number(texto.replace(/\./g, '').replace(',', '.'));
    if (texto.trim() !== '' && Number.isFinite(v) && v >= 0) informar(v);
    setTexto(null);
  };
  return (
    <input className="field dp-folha-campo" autoFocus inputMode="decimal" value={texto} aria-label="Total da folha do mês"
      onChange={e => setTexto(e.target.value)} onBlur={gravar}
      onKeyDown={e => { if (e.key === 'Enter') gravar(); if (e.key === 'Escape') setTexto(null); }} />
  );
}

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

export function PainelDoDp({ aba }: { aba: AbaDoPainel }) {
  const vm = usePainelDoDp(aba);
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

      {vm.carregando ? <Esqueleto numeros={4} linhas={6} /> : vm.resumo ? (
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
        </>
      ) : (
        <>

          <section className="card dp-lista">
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">{vm.tituloDaParte}</h3>
              <span className="badge badge-neutral">{vm.quantas}</span>
              {vm.faltam > 0 ? <span className="hint">{vm.faltam} {vm.faltam === 1 ? 'falta' : 'faltam'}</span> : <span className="hint">tudo feito</span>}
              <span className="tarefas-barra-espaco" />
              <span className="hint">Agrupar por</span>
              <Segmentado valor={f.agrupar} opcoes={AGRUPAR} onMudar={f.setAgrupar} />
            </div>
            {vm.quantas === 0 ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              <div className="table-wrap">
                <table className="dp-tabela">
                  <thead>
                    <tr className="dp-cabeca-grupo">
                      <th colSpan={4} />
                      {vm.gruposDeColunas.map(g => <th key={g.rotulo} colSpan={g.colunas} className="dp-ob-grupo dp-ob-primeira">{g.rotulo}</th>)}
                      <th />
                    </tr>
                    <tr>
                      <th>Cód.</th><th>Cliente</th><th>Responsável</th><th className="num" title="O total da folha do mês (o Fiscal vê ao lado do faturamento)">Folha do mês</th>
                      {vm.colunas.map(o => <th key={o.id} className={'dp-ob' + (vm.primeiras.has(o.id) ? ' dp-ob-primeira' : '')} title={o.nome}>{o.rotulo}</th>)}
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.grupos.map(g => (
                      <Fragment key={g.nome || 'todos'}>
                        {g.nome && <tr className="dp-grupo"><td colSpan={5 + vm.colunas.length}>{g.nome} <span className="hint">{g.feitas}/{g.linhas.length} concluídos</span></td></tr>}
                        {g.linhas.map(c => (
                          <tr key={c.chave} className={'dp-linha' + (c.concluida ? ' feita' : '')}>
                            <td className="num fraco">{c.codigo}</td>
                            <td className="dp-cliente"><span className="dp-cliente-nome" title={c.nomeNaTela}>{c.nomeNaTela}</span></td>
                            <td>{c.responsavel ? c.responsavelNome : <span className="fraco">—</span>}</td>
                            <td className="num">{c.obrigacoes.some(o => o.id === 'folha' && o.estado !== 'nao-tem')
                              ? <FolhaNaLinha valor={vm.folhaDe(c.codigo)} informar={v => vm.informarFolha(c.codigo, v)} travado={vm.carregando} />
                              : <span className="fraco">—</span>}</td>
                            {c.obrigacoes.map(o => (
                              <td key={o.id} className={'dp-ob' + (vm.primeiras.has(o.id) ? ' dp-ob-primeira' : '')}>
                                {o.estado === 'nao-tem' ? <span className="dp-marca nao-tem" title="não tem no mês">–</span> : o.id === 'reinf' ? (
                                  // a REINF é o Fiscal que transmite (Vitor, 07/10/2026): no DP só aparece se já foi
                                  <span className={'dp-marca leitura ' + o.estado} title={o.estado === 'feita' ? 'Transmitida pelo Fiscal' + (o.quem ? ': ' + o.quem : '') : 'Aguardando o Fiscal transmitir'}
                                    aria-label={'REINF de ' + c.nomeNaTela + (o.estado === 'feita' ? ': transmitida' : ': não transmitida')}>
                                    {o.estado === 'feita' ? '✓' : ''}
                                  </span>
                                ) : (
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
