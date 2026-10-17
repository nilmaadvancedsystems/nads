// O Painel do DP (Vitor, 06/10/2026: o Checklist Folha no visual do nads), uma página por aba do alto (Resumo, Folha,
// eSocial, Guias, Entrega): a competência e os filtros em cima; no Resumo, os números
// do mês; as barras por responsável, enquadramento e movimento; o progresso de cada responsável; e a lista dos clientes
// com as obrigações do mês (– não tem, vazio a fazer, ✓ feita, ! parada). Tudo roda aqui: clicar na bolinha marca a
// obrigação como feita, clicar de novo desfaz (sem o checklist).
import { formatos } from '@nads/core';
import { baixarBytes, BarrasEmColuna, CartaoComAnel, Esqueleto, Icone, Interruptor, MenuSuspenso, NumeroQueConta, RoscaComLegenda, Segmentado, useCarregando, useEntradaAnimada, type TomDoPainel } from '@nads/ui';
import { Fragment, useState } from 'react';
import { DecimoNaLista } from './DecimoTerceiro';
import { JanelaDasEtiquetas } from './JanelaDasEtiquetas';
import { useEtiquetasDaFolha } from './useEtiquetasDaFolha';
import { MenuDeFiltro } from './MenuDeFiltro';
import { ROTULO_DASH, usePainelDoDp, type AbaDoPainel, type Agrupar, type EstadoDaObrigacao, type SituacaoDoDash } from './usePainelDoDp';

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

// a rosca do Resumo (Savio, 15/10/2026): a ordem e a cor de cada situação, e o selo dela na lista
const ORDEM_DASH: SituacaoDoDash[] = ['atrasada', 'pendente', 'feita', 'sem'];
const TOM_DASH: Record<SituacaoDoDash, TomDoPainel> = { atrasada: 'perigo', pendente: 'aviso', feita: 'ok', sem: 'neutro' };
const BADGE_DASH: Record<SituacaoDoDash, string> = { atrasada: 'badge-bad', pendente: 'badge-warn', feita: 'badge-ok', sem: 'badge-neutral' };
/** o prazo do cartão: parado há N dias; ou o mês fechou há N dias / fecha em N dias */
function prazoDoCartao(dias: number, parado: boolean): string {
  const n = Math.abs(dias);
  const d = n === 1 ? ' dia' : ' dias';
  if (parado) return n === 0 ? 'Parado hoje' : 'Parado há ' + n + d;
  return dias < 0 ? 'Mês fechado há ' + n + d : dias === 0 ? 'O mês fecha hoje' : 'O mês fecha em ' + n + d;
}

const AGRUPAR: { valor: Agrupar; rotulo: string }[] = [{ valor: 'nenhum', rotulo: 'Nenhum' }, { valor: 'responsavel', rotulo: 'Responsável' }, { valor: 'agrupamento', rotulo: 'Agrupamento' }];

export function PainelDoDp({ aba }: { aba: AbaDoPainel }) {
  const vm = usePainelDoDp(aba);
  const f = vm.filtros;
  // as etiquetas da folha (Savio, 15/10/2026): a janela com a competência e a data de pagamento, e a impressão
  const etiquetas = useEtiquetasDaFolha(vm.competencia);
  // o 13º salário (Vitor, 13/10/2026): o interruptor ao lado do Agrupar por, só em novembro (1ª parcela) e dezembro (2ª)
  const [decimo, setDecimo] = useState(false);
  // o mês do 13º: o da competência escolhida, se for novembro ou dezembro; se não, o de hoje (em novembro a lista ainda
  // abre em outubro, e a 1ª parcela é desse novembro)
  const compMes = Number(vm.competencia.slice(5, 7));
  const hoje = new Date();
  const doDecimo = compMes === 11 || compMes === 12 ? { mes: compMes, ano: Number(vm.competencia.slice(0, 4)) }
    : hoje.getMonth() + 1 >= 11 ? { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() } : null;
  const temDecimo = aba === 'obrigacoes' && !!doDecimo;
  const mostrarDecimo = temDecimo && decimo;
  const mesDaCompetencia = doDecimo?.mes || 0;
  useCarregando(vm.carregando);
  // o DP animado (Vitor, 14/10/2026: "quero animar o DP inteiro"): a tabela entra em cascata ao abrir e ao trocar a aba
  const tabela = useEntradaAnimada<HTMLDivElement>('tbody > tr', [aba, vm.carregando], 'lista');
  return (
    <section className="dp-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        {/* a barra no padrão do resto do app (revisão da UI, 16/10/2026): a competência, a busca de lupa e os filtros em menus numa linha */}
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
            onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
        </label>
        <MenuDeFiltro rotulo="Responsável" valor={f.responsavel} mudar={f.setResponsavel} opcoes={f.responsaveis} />
        <MenuDeFiltro rotulo="Movimento" valor={f.movimento} mudar={f.setMovimento} opcoes={f.movimentos} />
        <MenuDeFiltro rotulo="Enquadramento" valor={f.enquadramento} mudar={f.setEnquadramento} opcoes={f.enquadramentos} />
        <MenuDeFiltro rotulo="Status" valor={f.status} mudar={v => f.setStatus(v as typeof f.status)}
          opcoes={[{ valor: 'concluidas', rotulo: 'Concluídos' }, { valor: 'pendentes', rotulo: 'Pendentes' }]} />
        <MenuDeFiltro rotulo="Pendente em" valor={f.pendenteEm} mudar={v => f.setPendenteEm(v as typeof f.pendenteEm)} opcoes={f.partes} todos="Todas as partes" />
        <MenuDeFiltro rotulo="Entrega" valor={f.entrega} mudar={f.setEntrega} opcoes={f.entregas} />
        <MenuDeFiltro rotulo="Agrupamento" valor={f.agrupamento} mudar={f.setAgrupamento} opcoes={f.agrupamentos} direita />
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
      </div>

      {vm.carregando ? <Esqueleto numeros={4} linhas={6} /> : vm.resumo ? (
        <>
          <div className="stat-grid dp-numeros">
            {vm.numeros.map(n => (
              <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
                <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value"><NumeroQueConta texto={String(n.valor)} /></p>
                {n.dica && <p className="hint dp-numero-dica">{n.dica}</p>}
              </div>
            ))}
          </div>

          {/* o dashboard no padrão de Senhas › Certificados (Savio, 15/10/2026): a rosca da situação (a legenda filtra), as barras
              do que falta em cada parte da rotina (a barra filtra) e os cartões de quem pede atenção */}
          <div className="cert-dash">
            <section className="card cert-dash-bloco">
              <div className="card-head"><h3>Situação do mês</h3></div>
              <RoscaComLegenda fatias={ORDEM_DASH.map(s => ({ id: s, rotulo: ROTULO_DASH[s], valor: vm.dash.contagem[s], tom: TOM_DASH[s] }))}
                total={vm.numeros[0].valor} subtitulo="clientes" ativa={vm.dash.parte ? null : vm.dash.situacao} onEscolher={s => vm.dash.escolherSituacao(s as SituacaoDoDash)} />
            </section>
            <section className="card cert-dash-bloco">
              <div className="card-head"><h3>O que falta em cada parte da rotina</h3></div>
              <BarrasEmColuna ativa={vm.dash.parte} onEscolher={vm.dash.escolherParte}
                colunas={vm.dash.porParte.map(p => ({ chave: p.id, rotulo: p.rotulo, total: p.faltam, aviso: true, leitura: p.faltam + (p.faltam === 1 ? ' cliente falta' : ' clientes faltam') + ' em ' + p.rotulo }))} />
            </section>
          </div>

          {vm.dash.atencao.length > 0 && (
            <div className="cert-urgentes">
              {vm.dash.atencao.slice(0, 8).map(a => (
                <CartaoComAnel key={a.chave} dias={a.dias} titulo={a.nome} atrasado={a.dias < 0} prazo={prazoDoCartao(a.dias, a.parado)}
                  apoio={a.codigo + ' · faltam ' + a.faltam + ' de ' + a.total + (a.paradas ? ' · ' + a.paradas + (a.paradas === 1 ? ' parada' : ' paradas') : '') + ' · ' + a.responsavel}
                  dica={'Mostrar só ' + a.nome + ' na tabela das obrigações'} onClick={() => f.setBusca(String(a.codigo))} />
              ))}
            </div>
          )}

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

          <section className="card cert-lista">
            <div className="card-head">
              <h3>{vm.dash.tituloDaLista}</h3>
              <span className="badge badge-neutral">{vm.dash.lista.length}</span>
            </div>
            {vm.dash.lista.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Cód.</th><th>Cliente</th><th>Responsável</th><th>Feitas</th><th>Situação</th></tr></thead>
                  <tbody>
                    {vm.dash.lista.map(l => (
                      <tr key={l.chave}>
                        <td className="num fraco">{l.codigo}</td>
                        <td className="cofre-nome">{l.nome}</td>
                        <td>{l.responsavel}</td>
                        <td className="num">{l.feitas}/{l.total}</td>
                        <td><span className={'badge ' + BADGE_DASH[l.situacao]}>{l.situacao === 'sem' ? ROTULO_DASH.sem : l.rotuloDaSituacao}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="fraco cert-painel-vazio">Nenhum cliente aqui.</p>}
          </section>
        </>
      ) : (
        <>

          {mostrarDecimo ? (
            <DecimoNaLista ano={doDecimo?.ano || hoje.getFullYear()} parcela={mesDaCompetencia === 11 ? '1' : '2'}
              busca={f.busca} responsavel={f.responsavel} status={f.status} desligar={() => setDecimo(false)} />
          ) : (
          <section className="card dp-lista">
            <div className="dp-lista-topo">
              <h3 className="dp-titulo">{vm.tituloDaParte}</h3>
              <span className="badge badge-neutral">{vm.quantas}</span>
              {vm.faltam > 0 ? <span className="hint">{vm.faltam} {vm.faltam === 1 ? 'falta' : 'faltam'}</span> : <span className="hint">tudo feito</span>}
              <span className="tarefas-barra-espaco" />
              {/* a tabela atual em Excel (Vitor, 07/10/2026) */}
              <button type="button" className="btn btn-outline" onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
                <Icone nome="download" />Exportar Excel
              </button>
              {/* o gerador de etiquetas da folha (Savio, 15/10/2026): pergunta a competência e a data de pagamento e imprime em A4 */}
              {aba === 'obrigacoes' && <button type="button" className="btn btn-outline" onClick={etiquetas.abrir}><Icone nome="printer" />Etiquetas da folha</button>}
              <span className="hint">Agrupar por</span>
              <Segmentado valor={f.agrupar} opcoes={AGRUPAR} onMudar={f.setAgrupar} />
              {temDecimo && (
                <>
                  <span className="hint">13º salário</span>
                  <Interruptor ligado={false} onMudar={() => setDecimo(true)} rotulo={'Mostrar o 13º salário (' + (mesDaCompetencia === 11 ? '1ª' : '2ª') + ' parcela)'} />
                </>
              )}
            </div>
            {vm.quantas === 0 ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              <div className="table-wrap" ref={tabela}>
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
                      <th className="dp-onde">Onde</th>
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
                            <td className="dp-onde fraco">{c.entrega || '—'}</td>
                            <td><span className={'badge ' + (c.concluida ? 'badge-ok' : c.parada ? 'badge-parada' : 'andamento' in c && c.andamento ? 'badge-warn' : 'badge-neutral')}>{c.situacao}</span></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          )}
        </>
      )}
      <JanelaDasEtiquetas vm={etiquetas} />
    </section>
  );
}
