// O faturamento detalhado de um cliente (Fiscal › Faturamento; 22/10/2026: "quando eu clique no cliente abra um
// faturamento detalhado"): de cima para baixo, os números do período, o mês a mês (clicar num mês escolhe o mês) e, no
// mês escolhido, para quem vendeu e por CFOP. Só as peças do catálogo (modal, BotaoFechar, Stat, Tabela padrão, Ranking).
import { BotaoFechar, Stat, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { useDetalheDoFaturamento } from './useDetalheDoFaturamento';

const brl = (n: number | null | undefined) => (n == null ? '' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export function JanelaDoFaturamento({ cliente, competencias, rotuloDoPeriodo, anual, fechar }: {
  cliente: { codigo: number; nome: string; regime: string }; competencias: readonly string[]; rotuloDoPeriodo: string; anual: boolean; fechar: () => void;
}) {
  const vm = useDetalheDoFaturamento(cliente.codigo, cliente.nome, competencias, anual);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal fat-detalhe" role="dialog" aria-modal="true" aria-labelledby="fatDetalheTitulo">
        <header className="fat-detalhe-topo">
          <div>
            <h3 id="fatDetalheTitulo">{cliente.codigo} · {cliente.nome}</h3>
            <p className="fraco">{cliente.regime || 'Sem regime'} · {rotuloDoPeriodo} · NF-e e NFC-e emitidas no SIEG, sem as canceladas</p>
          </div>
          <BotaoFechar onClick={fechar} />
        </header>

        <div className="stat-grid">
          <Stat rotulo="Total no período" valor={'R$ ' + brl(vm.numeros.total)} />
          <Stat rotulo={'Média por mês (' + vm.numeros.mesesComDado + (vm.numeros.mesesComDado === 1 ? ' mês' : ' meses') + ' com dado)'} valor={'R$ ' + brl(vm.numeros.media)} />
          <Stat rotulo={'Maior mês' + (vm.numeros.maior ? ' · ' + vm.numeros.maior.rotulo : '')} valor={vm.numeros.maior ? 'R$ ' + brl(vm.numeros.maior.valor) : '—'} />
          <Stat rotulo="Notas emitidas" valor={vm.numeros.notas.toLocaleString('pt-BR')} />
        </div>

        <div className="fat-detalhe-corpo">
          <section className="card fat-detalhe-meses">
            <h3>Mês a mês</h3>
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Mês</th><th className="num">NF-e</th><th className="num">NFC-e</th><th className="num">Notas</th><th className="num">Total</th><th className="num">Var.</th></tr></thead>
                <tbody>
                  {vm.meses.map(m => (
                    <tr key={m.competencia} className={(m.escolhido ? 'fat-mes-escolhido' : '') + (m.total == null ? ' fraco' : ' fat-mes')}
                      onClick={m.total == null ? undefined : () => vm.escolher(m.competencia)} title={m.total == null ? 'Sem dado neste mês' : 'Ver as notas de ' + m.rotulo}>
                      <td>{m.rotulo}</td>
                      <td className="num">{brl(m.nfe)}</td>
                      <td className="num">{brl(m.nfce)}</td>
                      <td className="num">{m.total == null ? '' : m.notas + (m.canceladas ? ' (' + m.canceladas + ' canc.)' : '')}</td>
                      <td className="num"><b>{m.total == null ? 'sem dado' : brl(m.total)}</b></td>
                      <td className={'num' + (m.variacao == null ? '' : m.variacao < 0 ? ' faturamento-caiu' : ' faturamento-subiu')}>{m.variacao == null ? '' : (m.variacao > 0 ? '+' : '') + String(m.variacao).replace('.', ',') + '%'}</td>
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
                  <p className="fat-detalhe-sub">Para quem vendeu</p>
                  <div className="rank">
                    {vm.resumo.clientes.map(c => (
                      <div key={c.doc + c.nome} className="rank-item">
                        <span className="rank-nome" title={c.nome}>{c.nome} <span className="fraco">· {c.notas} {c.notas === 1 ? 'nota' : 'notas'}</span></span>
                        <span className="rank-val num">{brl(c.valor)}</span>
                        <span className="rank-barra"><span style={{ width: c.pct + '%', background: 'var(--accent)' }} /></span>
                      </div>
                    ))}
                  </div>
                  {vm.resumo.outrosClientes > 0 && <p className="fraco">e mais {vm.resumo.outrosClientes}</p>}
                  <p className="fat-detalhe-sub">Por CFOP</p>
                  <div className="rank">
                    {vm.resumo.cfops.map(c => (
                      <div key={c.cfop} className="rank-item">
                        <span className="rank-nome">{c.cfop}</span>
                        <span className="rank-val num">{brl(c.valor)}</span>
                        <span className="rank-barra"><span style={{ width: c.pct + '%', background: 'var(--info, var(--accent))' }} /></span>
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
    </div>
  );
}
