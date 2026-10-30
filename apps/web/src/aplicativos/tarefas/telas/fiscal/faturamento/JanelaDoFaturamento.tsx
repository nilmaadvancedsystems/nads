// O faturamento detalhado de um cliente (Fiscal › Faturamento; 22/10/2026: "quando eu clique no cliente abra um
// faturamento detalhado"): de cima para baixo, os números do período, a evolução (clicar num mês escolhe o mês), as notas
// do mês para procurar e abrir (por comprador ou por CFOP) e as despesas do mês. Só as peças do catálogo (modal,
// BotaoFechar, Stat, BarrasEmColuna, Segmentado, a busca curta, Tabela padrão).
import { BarrasEmColuna, BotaoFechar, Icone, Segmentado, Stat, useJanela, Variacao } from '@nads/ui';
import { useRef } from 'react';
import { EspelhoDaNota } from '../partes/EspelhoDaNota';
import { useDetalheDoFaturamento } from './useDetalheDoFaturamento';

const brl = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function JanelaDoFaturamento({ cliente, competencias, rotuloDoPeriodo, anual, fechar }: {
  cliente: { codigo: number; nome: string; regime: string }; competencias: readonly string[]; rotuloDoPeriodo: string; anual: boolean; fechar: () => void;
}) {
  const vm = useDetalheDoFaturamento(cliente.codigo, cliente.nome, competencias, anual);
  const janela = useRef<HTMLDivElement>(null);
  // com o espelho da nota aberto por cima, o Esc fecha só ele
  useJanela(janela, () => { if (!vm.vendo) fechar(); });
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      {vm.vendo && <EspelhoDaNota nota={vm.vendo} codigo={cliente.codigo} competencia={vm.mes?.competencia} fechar={vm.fecharNota} />}
      {/* no desenho da janela do Financeiro (o Resultado por conta; 23/10/2026: "agora tá muito grande… faça no estilo do
          financeiro"): o caminho no topo, o corpo rolando por dentro e o Fechar no pé; até 1240 px, só a altura que precisa */}
      <div ref={janela} className="modal registro-novo fat-detalhe fs-det" role="dialog" aria-modal="true" aria-labelledby="fatDetalheTitulo">
        <header className="registro-topo">
          <span className="registro-caminho" id="fatDetalheTitulo"><Icone nome="dinheiro" />Faturamento<Icone nome="chevronRight" /><b>{cliente.codigo} · {cliente.nome}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo fat-detalhe-corpo-geral">
        {/* quem é e de onde vêm os números (30/10/2026, o visual novo do Fiscal): o nome grande e as fichas embaixo */}
        <div className="fs-det-cabeca">
          <span className="fs-det-cod num">{cliente.codigo}</span>
          <div className="fs-det-nome">
            <h2>{cliente.nome}</h2>
            <p className="fs-det-fichas">
              <span className="badge badge-neutral">{cliente.regime || 'Sem regime'}</span>
              <span className="badge badge-neutral">{rotuloDoPeriodo}</span>
              <span className="fs-det-fonte">NF-e e NFC-e emitidas no SIEG, sem as canceladas</span>
            </p>
          </div>
        </div>

        <div className="stat-grid fin-numeros fs-det-numeros">
          {/* o número em cima e o detalhe embaixo, pequeno (23/10/2026: os rótulos longos quebravam no celular) */}
          <Stat rotulo="Total no período" valor={'R$ ' + brl(vm.numeros.total)} sub={vm.numeros.mesesComDado + (vm.numeros.mesesComDado === 1 ? ' mês com dado' : ' meses com dado')} />
          {vm.numeros.ultimo && (
            <Stat rotulo={vm.numeros.ultimo.rotulo} valor={'R$ ' + brl(vm.numeros.ultimo.valor)}
              sub={vm.numeros.ultimo.anterior ? <><Variacao pct={vm.numeros.ultimo.variacao} /> sobre {vm.numeros.ultimo.anterior}</> : 'o último mês com dado'} />
          )}
          <Stat rotulo="Média por mês" valor={'R$ ' + brl(vm.numeros.media)} sub="nos meses com dado" />
          <Stat rotulo="Ticket médio" valor={'R$ ' + brl(vm.numeros.ticket)} sub="o valor médio de cada nota" />
          <Stat rotulo="Maior mês" valor={vm.numeros.maior ? 'R$ ' + brl(vm.numeros.maior.valor) : '—'} sub={vm.numeros.maior?.rotulo} />
          <Stat rotulo="Notas emitidas" valor={vm.numeros.notas.toLocaleString('pt-BR')} sub={vm.numeros.canceladas ? vm.numeros.canceladas + ' canceladas fora da conta' : 'nenhuma cancelada'} />
        </div>

        {/* a evolução (o gráfico de barras dos painéis de faturamento): clicar no mês escolhe as notas dele; embaixo, o mix */}
        <section className="card fat-detalhe-evolucao">
          <h3>Evolução <span className="fraco">· clique no mês para ver as notas dele</span></h3>
          <BarrasEmColuna colunas={vm.barras} ativa={vm.mes?.competencia ?? null} onEscolher={vm.escolher} />
          {vm.semDado > 0 && <p className="fraco fat-sem-dado">{vm.semDado === 1 ? '1 mês' : vm.semDado + ' meses'} do período sem dado no SIEG (no período Ano, aparecem vazios)</p>}
          {/* o mix numa barra só, as duas partes com a legenda de bolinha */}
          <div className="fs-mix" aria-label="NF-e e NFC-e no período">
            <span className="fs-mix-barra" aria-hidden="true">
              <span className="fs-mix-nfe" style={{ width: vm.numeros.mix.pctNfe + '%' }} />
              <span className="fs-mix-nfce" style={{ width: vm.numeros.mix.pctNfce + '%' }} />
            </span>
            <span className="fs-mix-item"><i className="fs-mix-nfe" /><b>NF-e</b> {vm.numeros.mix.pctNfe}% · R$ {brl(vm.numeros.mix.nfe)}</span>
            <span className="fs-mix-item"><i className="fs-mix-nfce" /><b>NFC-e</b> {vm.numeros.mix.pctNfce}% · R$ {brl(vm.numeros.mix.nfce)}</span>
          </div>
        </section>

        {/* as notas do mês escolhido, para procurar e abrir (23/10/2026: "por que não tem como eu ver todos os clientes /
            abrir e ver / pesquisar as notas por aqui?" e "ver as notas por CFOP se eu clicar"): por comprador ou por CFOP,
            a busca, cada linha abre as notas dela e cada nota abre no espelho */}
        <section className="card fat-notas">
          <h3>
            <span>{vm.mes ? 'As notas de ' + vm.mes.rotulo : 'As notas do mês'}{vm.resumo && <span className="fraco"> · {vm.resumo.quantidade} {vm.resumo.quantidade === 1 ? 'nota' : 'notas'}{vm.resumo.canceladas ? ', ' + vm.resumo.canceladas + ' canceladas fora da conta' : ''}</span>}</span>
          </h3>
          {!vm.mes ? <p className="fraco">Nenhum mês com faturamento no período.</p>
            : vm.carregandoNotas ? <p className="fraco">Lendo as notas…</p>
            : !vm.resumo ? <p className="fraco">As notas deste mês ainda não foram baixadas. Em Fiscal › Painel, use o Baixar XMLs do cliente para ver as notas aqui.</p>
            : (
              <>
                <div className="fat-notas-barra">
                  <Segmentado valor={vm.modo} onMudar={vm.setModo} opcoes={[{ valor: 'comprador', rotulo: 'Por comprador' }, { valor: 'cfop', rotulo: 'Por CFOP' }]} />
                  <label className="busca-curta">
                    <Icone nome="search" width={16} height={16} />
                    <input type="text" placeholder={vm.modo === 'comprador' ? 'Comprador, CNPJ ou nº da nota' : 'CFOP ou nº da nota'} aria-label="Procurar nas notas do mês" value={vm.busca} onChange={ev => vm.setBusca(ev.target.value)} />
                  </label>
                  <span className="fraco">{vm.busca ? vm.gruposAchados + ' de ' + vm.totalDeGrupos : vm.totalDeGrupos} {vm.modo === 'comprador' ? (vm.totalDeGrupos === 1 ? 'comprador' : 'compradores') : 'CFOPs'}</span>
                </div>
                {!vm.grupos.length ? <p className="fraco">Nada com essa busca.</p> : (
                  <div className="fat-grupos">
                    {vm.grupos.map(g => (
                      <div key={g.chave} className={'fat-grupo' + (g.aberto ? ' aberto' : '')}>
                        <button type="button" className="fat-grupo-linha" aria-expanded={g.aberto} onClick={() => vm.abrirGrupo(g.chave)}>
                          <Icone nome={g.aberto ? 'caretDown' : 'chevronRight'} width={14} height={14} />
                          <span className="fat-grupo-nome" title={g.rotulo}>{g.rotulo}{g.doc && <span className="fraco num"> · {g.doc}</span>}</span>
                          <span className="fraco">{g.notas.length} {g.notas.length === 1 ? 'nota' : 'notas'} · {g.pct.toLocaleString('pt-BR')}%</span>
                          <b className="num">{brl(g.valor)}</b>
                          <span className="fat-grupo-barra" aria-hidden="true"><span style={{ width: g.barra + '%' }} /></span>
                        </button>
                        {g.aberto && (
                          <div className="table-wrap fat-grupo-notas">
                            <table className="table-compact">
                              <thead><tr><th>Nota</th><th>Data</th>{vm.modo === 'cfop' && <th>Para</th>}<th className="num">{vm.modo === 'cfop' ? 'Valor no CFOP' : 'Valor'}</th><th aria-label="Ver a nota" /></tr></thead>
                              <tbody>
                                {g.notas.map(n => (
                                  <tr key={n.chave} className="fat-nota" onClick={() => vm.verNota(n.chave)}>
                                    <td><b>{n.titulo}</b></td><td className="num">{n.data}</td>{vm.modo === 'cfop' && <td className="wrap">{n.para}</td>}
                                    <td className="num">{brl(n.valor)}</td>
                                    <td className="nf-direita"><button type="button" className="btn btn-ghost btn-sm" title="Ver a nota (e a nota original)" onClick={ev => { ev.stopPropagation(); vm.verNota(n.chave); }}><Icone nome="olho" width={14} height={14} />Ver</button></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {vm.faltam > 0 && <button type="button" className="btn btn-outline fat-mais" onClick={vm.mostrarMais}>Mostrar mais {Math.min(30, vm.faltam)} (faltam {vm.faltam})</button>}
              </>
            )}
        </section>

        {/* as despesas do mês pelo balancete dinâmico do Contábil (22/10/2026: "fgts, água, dentre outros") */}
        {vm.mes && (
          <section className="card fat-detalhe-despesas">
            <h3>Despesas de {vm.mes.rotulo}{vm.despesas ? <span className="fraco"> · R$ {brl(vm.despesas.total)}</span> : null}</h3>
            {(vm.despesas?.destaques.length || vm.guiaFgts) ? (
              <div className="fat-destaques">
                {vm.guiaFgts && <div className="fat-destaque"><span className="fraco">Guia do FGTS</span><b className="num">R$ {vm.guiaFgts.valor}</b>{vm.guiaFgts.vencimento && <span className="fraco">vence {vm.guiaFgts.vencimento}</span>}</div>}
                {vm.despesas?.destaques.map(x => <div key={x.rotulo} className="fat-destaque"><span className="fraco">{x.rotulo}</span><b className="num">R$ {brl(x.valor)}</b></div>)}
              </div>
            ) : null}
            {!vm.temDinamico ? <p className="fraco">O balancete dinâmico desta empresa ainda não foi importado no Contábil (na Importação da rotina). Com ele, aparecem aqui as despesas do mês: água, energia, aluguel, salários, FGTS e as outras.</p>
              : !vm.despesas ? <p className="fraco">O balancete dinâmico importado não tem {vm.mes.rotulo}. Importe o mais novo no Contábil.</p>
              : !vm.despesas.contas.length ? <p className="fraco">Nenhuma despesa lançada no mês.</p>
              : (
                <>
                  <p className="fat-detalhe-sub">As maiores contas do mês</p>
                  <div className="rank">
                    {vm.despesas.contas.map(c => (
                      <div key={c.codigo} className="rank-item">
                        <span className="rank-nome" title={c.classificacao + ' · ' + c.descricao}>{c.descricao}</span>
                        <span className="rank-val num">{brl(c.valor)}</span>
                        <span className="rank-barra"><span style={{ width: Math.max(0, c.pct) + '%', background: 'var(--warn)' }} /></span>
                      </div>
                    ))}
                  </div>
                  {vm.despesas.outras > 0 && <p className="fraco">e mais {vm.despesas.outras} contas</p>}
                </>
              )}
          </section>
        )}
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
