// O faturamento detalhado de um cliente (Fiscal › Faturamento; 22/10/2026: "quando eu clique no cliente abra um
// faturamento detalhado"): de cima para baixo, os números do período, o mês a mês (clicar num mês escolhe o mês) e, no
// mês escolhido, para quem vendeu e por CFOP. Só as peças do catálogo (modal, BotaoFechar, Stat, Tabela padrão, Ranking).
import { BarrasEmColuna, BotaoFechar, Icone, Stat, useJanela, Variacao } from '@nads/ui';
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
      {vm.vendo && <EspelhoDaNota nota={vm.vendo} fechar={vm.fecharNota} />}
      {/* no desenho da janela do Financeiro (o Resultado por conta; 23/10/2026: "agora tá muito grande… faça no estilo do
          financeiro"): o caminho no topo, o corpo rolando por dentro e o Fechar no pé; até 1240 px, só a altura que precisa */}
      <div ref={janela} className="modal registro-novo fat-detalhe" role="dialog" aria-modal="true" aria-labelledby="fatDetalheTitulo">
        <header className="registro-topo">
          <span className="registro-caminho" id="fatDetalheTitulo"><Icone nome="dinheiro" />Faturamento<Icone nome="chevronRight" /><b>{cliente.codigo} · {cliente.nome}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo fat-detalhe-corpo-geral">
        <p className="fraco fat-detalhe-sobre">{cliente.regime || 'Sem regime'} · {rotuloDoPeriodo} · NF-e e NFC-e emitidas no SIEG, sem as canceladas</p>

        <div className="stat-grid fin-numeros">
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
          <h3>Evolução <span className="fraco">· em mil reais; clique no mês para ver as notas dele</span></h3>
          <BarrasEmColuna colunas={vm.barras} ativa={vm.mes?.competencia ?? null} onEscolher={vm.escolher} />
          <div className="fat-mix" aria-label="NF-e e NFC-e no período">
            <span className="fat-mix-barra" aria-hidden="true"><span style={{ width: vm.numeros.mix.pctNfe + '%' }} /></span>
            <span><b>NF-e</b> {vm.numeros.mix.pctNfe}% · R$ {brl(vm.numeros.mix.nfe)}</span>
            <span><b>NFC-e</b> {vm.numeros.mix.pctNfce}% · R$ {brl(vm.numeros.mix.nfce)}</span>
          </div>
        </section>

        <div className="fat-detalhe-corpo">
          <section className="card fat-detalhe-meses">
            <h3>Mês a mês</h3>
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Mês</th><th className="num">Total</th><th className="num">Variação</th><th className="num">NF-e</th><th className="num">NFC-e</th><th className="num">Notas</th></tr></thead>
                <tbody>
                  {vm.meses.map(m => (
                    <tr key={m.competencia} className={(m.escolhido ? 'fat-mes-escolhido' : '') + (m.total == null ? ' fraco' : ' fat-mes')}
                      onClick={m.total == null ? undefined : () => vm.escolher(m.competencia)} title={m.total == null ? 'Sem dado neste mês' : 'Ver as notas de ' + m.rotulo}>
                      <td>{m.rotulo}</td>
                      <td className="num"><b>{m.total == null ? 'sem dado' : brl(m.total)}</b></td>
                      <td className="num">{m.total == null ? '' : <Variacao pct={m.variacao} titulo="Contra o mês anterior" />}</td>
                      <td className="num fraco">{brl(m.nfe)}</td>
                      <td className="num fraco">{brl(m.nfce)}</td>
                      <td className="num fraco">{m.total == null ? '' : m.notas + (m.canceladas ? ' (' + m.canceladas + ' canc.)' : '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {vm.semDado > 0 && <p className="fraco">{vm.semDado === 1 ? '1 mês' : vm.semDado + ' meses'} do período sem dado no SIEG</p>}
          </section>

          <section className="card fat-detalhe-mes">
            <h3>{vm.mes ? 'As notas de ' + vm.mes.rotulo : 'As notas do mês'}</h3>
            {!vm.mes ? <p className="fraco">Nenhum mês com faturamento no período.</p>
              : vm.carregandoNotas ? <p className="fraco">Lendo as notas…</p>
              : !vm.resumo ? <p className="fraco">As notas deste mês ainda não foram baixadas. Em Fiscal › Painel, use o Baixar XMLs do cliente para ver para quem vendeu e por CFOP.</p>
              : (
                <>
                  <p className="fraco">{vm.resumo.quantidade} {vm.resumo.quantidade === 1 ? 'nota' : 'notas'}{vm.resumo.canceladas ? ' · ' + vm.resumo.canceladas + ' canceladas fora da conta' : ''}</p>
                  {/* a curva ABC (quem faz 80% do valor é A, os 15% seguintes B, o resto C) e a concentração */}
                  {vm.abc && (
                    <div className="stat-grid fin-numeros fat-abc">
                      <Stat grande={false} rotulo="Compradores no mês" valor={String(vm.abc.compradores)} sub={vm.abc.consumidor ? vm.abc.consumidor + '% para consumidor sem identificação' : 'todos identificados'} />
                      <Stat grande={false} rotulo="O maior comprador" valor={vm.abc.maior.toLocaleString('pt-BR') + '%'} sub="do valor do mês" />
                      <Stat grande={false} rotulo="Os 5 maiores" valor={vm.abc.cinco.toLocaleString('pt-BR') + '%'} sub="do valor do mês" />
                      <Stat grande={false} rotulo="Curva ABC" valor={<span className="fat-abc-classes">{(['A', 'B', 'C'] as const).map(k => <span key={k}><span className={'badge badge-suave fat-classe-' + k}>{k}</span> {vm.abc!.porClasse[k].clientes}</span>)}</span>} sub={'A faz ' + vm.abc.porClasse.A.pct.toLocaleString('pt-BR') + '% do valor'} />
                    </div>
                  )}
                  <p className="fat-detalhe-sub">Para quem vendeu</p>
                  <div className="rank">
                    {vm.resumo.clientes.map(c => (
                      <div key={c.doc + c.nome} className="rank-item">
                        <span className="rank-nome" title={c.nome}><span className={'badge badge-suave fat-classe-' + c.classe}>{c.classe}</span> {c.nome} <span className="fraco">· {c.notas} {c.notas === 1 ? 'nota' : 'notas'} · {c.pct.toLocaleString('pt-BR')}%</span></span>
                        <span className="rank-val num">{brl(c.valor)}</span>
                        <span className="rank-barra"><span style={{ width: c.barra + '%', background: 'var(--info, #3b82f6)' }} /></span>
                      </div>
                    ))}
                  </div>
                  {vm.resumo.outrosClientes > 0 && <p className="fraco">e mais {vm.resumo.outrosClientes}</p>}
                  {vm.maioresNotas.length > 0 && (
                    <>
                      <p className="fat-detalhe-sub">As maiores notas do mês</p>
                      <div className="table-wrap">
                        <table className="table-compact">
                          <thead><tr><th>Nota</th><th>Data</th><th>Para</th><th className="num">Valor</th><th aria-label="Ver a nota" /></tr></thead>
                          <tbody>
                            {vm.maioresNotas.map(n => (
                              <tr key={n.chave}>
                                <td><b>{n.titulo}</b></td><td className="num">{n.data}</td><td className="wrap">{n.para}</td><td className="num">{brl(n.valor)}</td>
                                <td className="nf-direita"><button type="button" className="btn btn-ghost btn-sm" title="Ver a nota (a chave, os itens e os totais)" onClick={() => vm.verNota(n.chave)}><Icone nome="olho" width={14} height={14} />Ver</button></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  <p className="fat-detalhe-sub">Por CFOP</p>
                  <div className="rank">
                    {vm.resumo.cfops.map(c => (
                      <div key={c.cfop} className="rank-item">
                        <span className="rank-nome">{c.cfop}</span>
                        <span className="rank-val num">{brl(c.valor)}</span>
                        <span className="rank-barra"><span style={{ width: c.pct + '%', background: 'var(--ink-muted)' }} /></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
          </section>
        </div>

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
