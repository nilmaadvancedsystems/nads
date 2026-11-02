// O Painel do DP (Vitor, 06/10/2026: o Checklist Folha no visual do nads), uma página por aba do alto (Resumo, Folha,
// eSocial, Guias, Entrega): a competência e os filtros em cima; no Resumo, os números
// do mês; as barras por responsável, enquadramento e movimento; o progresso de cada responsável; e a lista dos clientes
// com as obrigações do mês (– não tem, vazio a fazer, ✓ feita, ! parada). Tudo roda aqui: clicar na bolinha marca a
// obrigação como feita, clicar de novo desfaz (sem o checklist).
import { formatos } from '@nads/core';
import { baixarBytes, BotaoIcone, Esqueleto, Icone, Interruptor, LogoExcel, MenuSuspenso, NumeroQueConta, RoscaComLegenda, useCarregando, useEntradaAnimada, type TomDoPainel } from '@nads/ui';
import { Fragment, useState } from 'react';
import { DecimoNaLista } from './DecimoTerceiro';
import { JanelaDasEtiquetas } from './JanelaDasEtiquetas';
import { useEtiquetasDaFolha } from './useEtiquetasDaFolha';
import { MenuDeFiltroVarios } from './MenuDeFiltro';
import { ROTULO_DASH, usePainelDoDp, type AbaDoPainel, type EstadoDaObrigacao, type SituacaoDoDash } from './usePainelDoDp';

/**
 * O total da folha do mês na linha do cliente (Vitor, 07/10/2026: "trazer quanto é gasto em folha do DP"): mostra o valor
 * (ou "Informar"); um clique abre o campo; Enter grava, Esc desiste. O Fiscal vê ao lado do faturamento.
 */
function FolhaNaLinha({ valor, informar, travado }: { valor: number | null; informar: (v: number) => void; travado: boolean }) {
  const [texto, setTexto] = useState<string | null>(null);
  if (texto == null) {
    return (
      <button type="button" className="btn btn-ghost dp-folha" disabled={travado} title={valor != null ? 'O total da folha do mês (salários, pró-labore e encargos)' : 'Informar o total da folha do mês'}
        aria-label={valor != null ? undefined : 'Informar o total da folha do mês'}
        onClick={() => setTexto(valor != null ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '')}>
        {/* sem valor, só o + (Vitor, 28/10/2026: "o Informar, troque por um ícone de +") */}
        {valor != null ? <span className="num">{formatos.reais(valor)}</span> : <Icone nome="plus" />}
      </button>
    );
  }
  const gravar = () => {
    // o mesmo parse do campo de valor do Relatório do Fiscal: "1234.56" é 1.234,56 (não 123456; 30/10/2026)
    const v = formatos.numeroDigitado(texto);
    if (v != null && v >= 0) informar(v);
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

// a rosca do Resumo (Savio, 15/10/2026): a ordem e a cor de cada situação
const ORDEM_DASH: SituacaoDoDash[] = ['atrasada', 'pendente', 'feita', 'sem'];
const TOM_DASH: Record<SituacaoDoDash, TomDoPainel> = { atrasada: 'perigo', pendente: 'aviso', feita: 'ok', sem: 'neutro' };

export function PainelDoDp({ aba }: { aba: AbaDoPainel }) {
  const vm = usePainelDoDp(aba);
  const f = vm.filtros;
  // as etiquetas da folha (Savio, 15/10/2026): a janela com a competência e a data de pagamento, e a impressão
  const etiquetas = useEtiquetasDaFolha(vm.competencia);
  // os filtros avançados (Vitor, 28/10/2026: "reduza esses filtros, coloque um ícone de filtro"): Movimento, Enquadramento,
  // Entrega e Agrupamento numa segunda linha, que o funil abre e fecha
  const [avancados, setAvancados] = useState(false);
  const algumAvancado = !!(f.movimento.length || f.enquadramento.length || f.entrega.length || f.agrupamento.length);
  // o 13º salário (Vitor, 13/10/2026): o interruptor no topo da tabela, só em novembro (1ª parcela) e dezembro (2ª)
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
  // a busca fica no topo da tabela, ao lado do Excel e da impressora (Vitor, 28/10/2026); sem a tabela (o Resumo, o 13º), na barra
  const busca = (
    <label className="busca-curta">
      <Icone nome="search" />
      <input type="text" value={f.busca} onChange={e => f.setBusca(e.target.value)} placeholder="Buscar cliente" aria-label="Buscar cliente (nome ou código)"
        onKeyDown={e => { if (e.key === 'Escape') f.setBusca(''); }} />
    </label>
  );
  const buscaNaTabela = !vm.resumo && !mostrarDecimo;
  return (
    <section className="dp-painel">
      <div className="tarefas-barra-topo dp-filtros-linha">
        {/* a barra no padrão do resto do app (revisão da UI, 16/10/2026): a competência, a busca de lupa e os filtros em menus numa linha */}
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
        {!buscaNaTabela && busca}
        <MenuDeFiltroVarios rotulo="Responsável" valores={f.responsavel} mudar={f.setResponsavel} opcoes={f.responsaveis} />
        {/* o Status com a situação da coluna (21/10/2026: "preciso de um filtro melhor de status"); pode marcar mais de um */}
        <MenuDeFiltroVarios rotulo="Status" valores={f.status} mudar={f.setStatus} opcoes={f.statusOpcoes} />
        <MenuDeFiltroVarios rotulo="Pendente em" valores={f.pendenteEm} mudar={f.setPendenteEm} opcoes={f.partes} todos="Todas as partes" />
        <button type="button" className={'btn btn-outline' + (algumAvancado ? ' ativo' : '')} aria-pressed={avancados} onClick={() => setAvancados(a => !a)}
          title={avancados ? 'Esconder os filtros avançados' : 'Filtros avançados: movimento, enquadramento, entrega e agrupamento'}
          aria-label="Filtros avançados"><Icone nome="funil" /></button>
        {f.algum && <button type="button" className="btn btn-ghost dp-limpar" onClick={f.limpar}><Icone nome="x" />Limpar filtros</button>}
      </div>
      {avancados && (
        <div className="tarefas-barra-topo dp-filtros-linha">
          <MenuDeFiltroVarios rotulo="Movimento" valores={f.movimento} mudar={f.setMovimento} opcoes={f.movimentos} />
          <MenuDeFiltroVarios rotulo="Enquadramento" valores={f.enquadramento} mudar={f.setEnquadramento} opcoes={f.enquadramentos} />
          <MenuDeFiltroVarios rotulo="Entrega" valores={f.entrega} mudar={f.setEntrega} opcoes={f.entregas} />
          <MenuDeFiltroVarios rotulo="Agrupamento" valores={f.agrupamento} mudar={f.setAgrupamento} opcoes={f.agrupamentos} />
        </div>
      )}

      {vm.carregando ? <Esqueleto numeros={4} linhas={6} /> : vm.resumo ? (
        <>
          <div className="stat-grid dp-numeros">
            {vm.numeros.map(n => (
              <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
                <p className="stat-label">{n.rotulo}</p>
                <p className="stat-value"><NumeroQueConta texto={String(n.valor)} /></p>
                {n.dica && <p className="hint dp-numero-dica">{n.dica}</p>}
              </div>
            ))}
          </div>

          {/* o dashboard no padrão de Senhas › Certificados (Savio, 15/10/2026): a rosca da situação e, ao lado, o progresso por
              responsável; as barras do que falta em cada parte, os cartões de quem pede atenção e a lista "Ainda faltam" saíram (Vitor, 28/10/2026) */}
          <div className="cert-dash">
            <section className="card cert-dash-bloco">
              <div className="card-head"><h3>Situação do mês</h3></div>
              <RoscaComLegenda fatias={ORDEM_DASH.map(s => ({ id: s, rotulo: ROTULO_DASH[s], valor: vm.dash.contagem[s], tom: TOM_DASH[s] }))}
                total={vm.numeros[0].valor} subtitulo="clientes" ativa={null} onEscolher={() => undefined} />
              {/* na mesma caixa (Vitor, 28/10/2026: "aprimore, mas sem criar outra box"): o quanto do mês já foi, só de quem tem movimento */}
              {(() => {
                const k = vm.dash.contagem;
                const comMovimento = k.atrasada + k.pendente + k.feita;
                const pct = comMovimento ? Math.round((k.feita / comMovimento) * 100) : 0;
                return (
                  <div className="dp-situacao-andamento">
                    <span className="dp-pessoa-topo"><b>Andamento do mês</b><span className="num">{pct}%</span></span>
                    <span className="dp-pessoa-barra"><span style={{ width: pct + '%' }} /></span>
                    <span className="hint">
                      {k.feita} de {comMovimento} {comMovimento === 1 ? 'cliente com movimento concluído' : 'clientes com movimento concluídos'}
                      {k.atrasada ? ' · ' + k.atrasada + (k.atrasada === 1 ? ' atrasado' : ' atrasados') : ' · nenhum atrasado'}
                    </span>
                  </div>
                );
              })()}
            </section>
            <section className="card dp-progresso">
              <h3 className="dp-titulo">Progresso por responsável</h3>
              <div className="dp-progresso-grade">
                {vm.progresso.map(p => (
                  <button key={p.nome} type="button" className={'dp-pessoa' + (f.responsavel.includes(p.nome) ? ' ativa' : '')}
                    onClick={() => f.setResponsavel(f.responsavel.includes(p.nome) ? [] : [p.nome])} title={'Filtrar a lista: ' + p.nome}>
                    <span className="dp-pessoa-topo"><b>{p.nome}</b><span className="num">{p.feitos}/{p.total}</span></span>
                    <span className="dp-pessoa-barra"><span style={{ width: p.pct + '%' }} /></span>
                    <span className="hint">{p.pct}% concluído{p.parados ? ' · ' + p.parados + (p.parados === 1 ? ' parada' : ' paradas') : ''}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : (
        <>

          {mostrarDecimo ? (
            <DecimoNaLista ano={doDecimo?.ano || hoje.getFullYear()} parcela={mesDaCompetencia === 11 ? '1' : '2'}
              busca={f.busca} responsavel={f.responsavel.length === 1 ? f.responsavel[0] : ''} status={f.statusDoDecimo} desligar={() => setDecimo(false)} />
          ) : (
          <>
            {/* o topo da tabela (Vitor, 28/10/2026): sem o título, a contagem e o Agrupar por (o agrupamento fica no filtro de cima);
                à direita, a busca e os botões só com o ícone: o Excel e a impressora das etiquetas; fora da caixa da tabela ("tira
                essa borda maior") */}
            <div className="tarefas-barra-topo dp-filtros-linha">
              {temDecimo && (
                <>
                  <span className="hint">13º salário</span>
                  <Interruptor ligado={false} onMudar={() => setDecimo(true)} rotulo={'Mostrar o 13º salário (' + (mesDaCompetencia === 11 ? '1ª' : '2ª') + ' parcela)'} />
                </>
              )}
              <span className="tarefas-barra-espaco" />
              {busca}
              {/* a tabela atual em Excel (Vitor, 07/10/2026) */}
              <button type="button" className="icon-btn" title="Exportar a tabela para o Excel" aria-label="Exportar a tabela para o Excel"
                onClick={() => { const x = vm.exportar(); baixarBytes(x.bytes, x.nome, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}>
                <LogoExcel />
              </button>
              {/* o gerador de etiquetas da folha (Savio, 15/10/2026): pergunta a competência e a data de pagamento e imprime em A4 */}
              {aba === 'obrigacoes' && <BotaoIcone icone="printer" titulo="Etiquetas da folha" onClick={etiquetas.abrir} />}
            </div>
          <section className="card dp-lista dp-lista-fixa">
            {vm.quantas === 0 ? <p className="hint dp-vazio">Nenhum cliente com esses filtros.</p> : (
              <div className="table-wrap" ref={tabela}>
                <table className="dp-tabela">
                  <thead>
                    {/* o cabeçalho reestruturado (Vitor, 28/10/2026): Cód., Cliente, Folha do mês e Situação ocupam as duas linhas, alinhados
                        embaixo; em cima, só os grupos das obrigações (a Entrega cobre o Entregue e o Onde); fica fixo ao rolar a página */}
                    <tr className="dp-cabeca-grupo">
                      <th rowSpan={2}>Cód.</th>
                      <th rowSpan={2}>Cliente</th>
                      <th rowSpan={2} className="num" title="O total da folha do mês (o Fiscal vê ao lado do faturamento)">Folha do mês</th>
                      {vm.gruposDeColunas.map(g => <th key={g.rotulo} colSpan={g.colunas} className="dp-ob-grupo dp-ob-primeira">{g.rotulo}</th>)}
                      <th rowSpan={2}>Situação</th>
                    </tr>
                    <tr>
                      {vm.colunas.map(o => <th key={o.id} className={'dp-ob' + (vm.primeiras.has(o.id) ? ' dp-ob-primeira' : '')} title={o.nome}>{o.rotulo}</th>)}
                      <th className="dp-ob dp-onde-cab">Onde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vm.grupos.map(g => (
                      <Fragment key={g.nome || 'todos'}>
                        {g.nome && <tr className="dp-grupo"><td colSpan={5 + vm.colunas.length}>{g.nome} <span className="hint">{g.feitas}/{g.linhas.length} concluídos</span></td></tr>}
                        {g.linhas.map(c => (
                          <tr key={c.chave} className={'dp-linha' + (c.concluida ? ' feita' : '')}>
                            <td className="num fraco">{c.codigo}</td>
                            <td className="dp-cliente dp-cliente-inteiro">
                              <span className="dp-cliente-nome">{c.nomeNaTela}</span>
                              <span className="dp-cliente-info">{c.responsavel ? c.responsavelNome : 'Sem responsável'}</span>
                            </td>
                            <td className="num">{c.obrigacoes.some(o => o.id === 'folha' && o.estado !== 'nao-tem')
                              ? <FolhaNaLinha valor={vm.folhaDe(c.codigo)} informar={v => vm.informarFolha(c.codigo, v)} travado={vm.carregando} />
                              : <span className="fraco">—</span>}</td>
                            {c.obrigacoes.map(o => (
                              <td key={o.id} className={'dp-ob' + (vm.primeiras.has(o.id) ? ' dp-ob-primeira' : '')}>
                                {o.estado === 'nao-tem' ? <span className="dp-marca nao-tem" title="não tem no mês">–</span> : o.id === 'reinf' ? (
                                  // a REINF é o Fiscal que transmite (Vitor, 07/10/2026): no DP só aparece se já foi
                                  <span className={'dp-marca leitura reinf ' + o.estado} title={o.estado === 'feita' ? 'Transmitida pelo Fiscal' + (o.quem ? ': ' + o.quem : '') : 'Aguardando o Fiscal transmitir'}
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
                            <td><span className={'badge ' + (c.concluida ? 'badge-ok' : c.parada ? 'badge-parada' : 'andamento' in c && c.andamento ? 'badge-warn badge-cheia' : 'badge-neutral')}>{c.situacao}</span></td>
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
        </>
      )}
      <JanelaDasEtiquetas vm={etiquetas} />
    </section>
  );
}
