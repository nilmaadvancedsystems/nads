// O painel do SIEG dentro do checklist da etapa do Fiscal: na Inicial, as notas do mês (emitidas e recebidas, por tipo);
// na Conferência de Saídas, a sequência (série por série: da primeira à última, os números que faltam e as canceladas),
// com o Baixar do SIEG (o robô do PC baixa as saídas do mês) e o Atualizar.
import { Alerta, BotaoAcao, Esqueleto, Icone } from '@nads/ui';
import { createPortal } from 'react-dom';
import { useSiegDaEtapa } from '../useSiegDaEtapa';

export function SiegDaEtapa({ tipo, codigo, competencia }: { tipo: 'contagem' | 'saidas'; codigo: string; competencia: string }) {
  const vm = useSiegDaEtapa(tipo, codigo, competencia);
  return (
    <section className="sieg-painel">
      <header className="sieg-topo">
        <b>SIEG</b>
        {vm.exemplos && <span className="fraco">dados de exemplo</span>}
        {vm.desligado && <span className="sieg-aviso"><Icone nome="alert" />{vm.desligado}</span>}
      </header>
      {/* o andamento do "Contar agora", flutuando no canto (fica no body: a faixa animada prenderia o fixo) */}
      {vm.andamento && createPortal(
        // a janela do andamento (08/10/2026: "quero uma porcentagem melhor e uma tela mais bem produzida"): as peças do
        // catálogo — o resumo com a barra (FGTS), a linha do robô, os números em painéis e os passos numa linha do tempo
        <div className="card gmail-andamento sieg-flutuante sieg-andamento" role="status" aria-live="polite">
          <div className="fgts-resumo-topo">
            <div className="fgts-resumo-titulo">
              <h3>{vm.andamento.erro ? vm.andamento.tituloDoErro : vm.andamento.titulo}</h3>
              {!vm.andamento.erro && <span className="hint">{vm.andamento.pronto ? 'Concluído' : vm.andamento.tempo || 'Começando…'}</span>}
            </div>
            {!vm.andamento.erro && <b className="sieg-andamento-pct num">{vm.andamento.pct}%</b>}
            <button type="button" className="btn btn-ghost" onClick={vm.fecharAndamento} aria-label="Fechar" title="Fechar"><Icone nome="x" /></button>
          </div>
          {!vm.andamento.erro && <span className={'tarefas-barra fgts-barra' + (vm.andamento.pronto ? '' : ' andando')}><span style={{ width: vm.andamento.pct + '%' }} /></span>}
          {vm.andamento.erro ? <p className="sieg-aviso"><Icone nome="alert" />{vm.andamento.erro}</p> : (
            <span className="fgts-robo-linha"><span className={'bolinha-sit ' + (vm.andamento.pronto ? 'concluida' : 'em-andamento')} aria-hidden="true" />{vm.andamento.pronto ? 'Robô terminou' : vm.andamento.detalhe || 'O robô está trabalhando'}</span>
          )}
          {vm.andamento.numeros && (
            <div className="stat-grid sieg-andamento-numeros">
              <div className="stat painel-numero painel-info"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="arquivo" /></span><p className="stat-label">XMLs</p><p className="stat-value num">{vm.andamento.numeros.xmls}</p></div>
              <div className="stat painel-numero painel-roxo"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="pasta" /></span><p className="stat-label">Já no Drive</p><p className="stat-value num">{vm.andamento.numeros.jaSalvos || vm.andamento.numeros.doDrive}</p></div>
              <div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="check" /></span><p className="stat-label">Novos salvos</p><p className="stat-value num">{vm.andamento.numeros.novos}</p></div>
            </div>
          )}
          {!vm.andamento.erro && (
            <ol className="fgts-passos sieg-andamento-passos">
              {vm.andamento.passos.map((p, i) => (
                <li key={p.texto} className={p.feito ? 'feito' : p.atual ? 'atual' : undefined}>
                  <span className="fgts-passo-marca" aria-hidden="true">{p.feito ? <Icone nome="check" /> : i + 1}</span>
                  <div>{p.atual ? <b>{p.texto}</b> : p.texto}</div>
                </li>
              ))}
            </ol>
          )}
          {vm.andamento.resultado && <p className="hint" style={{ margin: 0 }}>{vm.andamento.resultado}</p>}
          {vm.andamento.xmls && vm.zip && (
            <div className="sieg-acoes">
              <BotaoAcao className="btn btn-outline" carregando={vm.baixandoZip} textoCarregando="Baixando…" onClick={() => { void vm.baixarZip(); }}><Icone nome="download" />Baixar o .zip ({vm.zip.tamanho})</BotaoAcao>
            </div>
          )}
        </div>,
        document.body,
      )}
      {vm.tipo === 'contagem' ? (
        <>{!vm.contagemCarregada ? <Esqueleto linhas={2} /> : vm.contagem ? (
          <div className="sieg-contagem">
            {/* o rótulo em cima, o número grande e a proporção de cada tipo de nota (14/10/2026: "números mais legíveis") */}
            {[{ rotulo: 'Notas emitidas', n: vm.contagem.emitidas, linhas: vm.contagem.linhasEmitidas }, { rotulo: 'Notas recebidas', n: vm.contagem.recebidas, linhas: vm.contagem.linhasRecebidas }].map(x => (
              <div key={x.rotulo} className={'sieg-numero' + (x.n === 0 ? ' zero' : '')}>
                <span>{x.rotulo}</span>
                <b>{x.n}</b>
                {x.n > 0 && x.linhas.length > 0 && (
                  <>
                    <span className="sieg-proporcao" aria-hidden="true">{x.linhas.map((l, i) => <i key={l.rotulo} className={'sieg-tipo-' + i} style={{ flexGrow: l.n }} />)}</span>
                    <small>{x.linhas.map((l, i) => <span key={l.rotulo} className="sieg-legenda"><i className={'sieg-tipo-' + i} />{l.rotulo} {l.n}</span>)}</small>
                  </>
                )}
              </div>
            ))}
            {vm.contagem.emitidas === 0 && <div className="sieg-quando alerta-linha"><Alerta naLinha titulo="Nenhuma nota emitida" texto="Confira o certificado e a captura no SIEG." /></div>}
            <p className="fraco sieg-quando">Contadas no SIEG em {vm.contagem.quando}.</p>
            {/* contar de novo, na hora (07/10/2026: "tem como ter um botão para puxar na hora?") */}
            <div className="sieg-acoes">
              <BotaoAcao className="btn btn-outline" carregando={vm.contando} textoCarregando="Contando…" onClick={() => { void vm.contar(); }}><Icone nome="girar" />Contar de novo</BotaoAcao>
              <BotaoAcao className="btn btn-primary" carregando={vm.baixandoXmls} textoCarregando="Baixando…" onClick={() => { void vm.baixarXmls(); }}><Icone nome="download" />Baixar XMLs do SIEG</BotaoAcao>
            </div>
          </div>
        ) : (
          <div className="sieg-acoes">
            <p className="fraco" style={{ margin: 0, flex: 1 }}>O SIEG ainda não contou as notas deste mês (a contagem roda de madrugada).</p>
            <BotaoAcao className="btn btn-outline" carregando={vm.contando} textoCarregando="Contando…" onClick={() => { void vm.contar(); }}><Icone nome="girar" />Contar agora</BotaoAcao>
            <BotaoAcao className="btn btn-primary" carregando={vm.baixandoXmls} textoCarregando="Baixando…" onClick={() => { void vm.baixarXmls(); }}><Icone nome="download" />Baixar XMLs do SIEG</BotaoAcao>
          </div>
        )}
        {vm.erroDaContagem && <p className="fraco sieg-aviso"><Icone nome="alert" />A contagem não deu certo: {vm.erroDaContagem}</p>}
        {/* o último "Baixar XMLs do SIEG" (07/10/2026): quantos e onde estão */}
        {vm.xmls && <p className="hint" style={{ margin: '8px 0 0' }}><Icone nome="checkCircle" /> {vm.xmls.arquivos} XMLs baixados em {vm.xmls.quando} ({vm.xmls.emitidas} notas emitidas, {vm.xmls.recebidas} recebidas) · {vm.xmls.pasta}</p>}</>
      ) : (
        <>
          {vm.saidas ? (
            <div className="sieg-saidas">
              <div className={'sieg-resumo' + (vm.saidas.ok ? ' ok' : ' falta')}>
                <Icone nome={vm.saidas.ok ? 'checkCircle' : 'alert'} />
                <b>{vm.saidas.ok ? 'Sequência completa' : vm.saidas.faltando + (vm.saidas.faltando === 1 ? ' número faltando' : ' números faltando')}</b>
                <span className="fraco">{vm.saidas.autorizadas} {vm.saidas.autorizadas === 1 ? 'autorizada' : 'autorizadas'} · {vm.saidas.canceladas} {vm.saidas.canceladas === 1 ? 'cancelada' : 'canceladas'} · {vm.saidas.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
              {vm.saidas.cupons && (
                <div className="stat-grid sieg-cupons" aria-label="Cupons (NFC-e) do mês">
                  <div className="stat painel-numero painel-info"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="recibo" /></span><p className="stat-label">Cupons (NFC-e)</p><p className="stat-value num">{vm.saidas.cupons.quantidade.toLocaleString('pt-BR')}</p></div>
                  <div className="stat painel-numero painel-ok"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="dinheiro" /></span><p className="stat-label">Valor dos cupons</p><p className="stat-value num">{vm.saidas.cupons.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                  <div className="stat painel-numero painel-neutro"><span className="painel-numero-icone" aria-hidden="true"><Icone nome="hash" /></span><p className="stat-label">Numeração</p>
                    <p className="stat-value num sieg-cupons-faixa">{vm.saidas.cupons.numeracao.map(n => <span key={n.serie}>{n.primeira.toLocaleString('pt-BR')} a {n.ultima.toLocaleString('pt-BR')}{vm.saidas!.cupons!.numeracao.length > 1 && <small> {n.serie}</small>}</span>)}</p></div>
                  <div className={'stat painel-numero ' + (vm.saidas.cupons.faltando ? 'painel-aviso' : 'painel-ok')}><span className="painel-numero-icone" aria-hidden="true"><Icone nome={vm.saidas.cupons.faltando ? 'alert' : 'check'} /></span><p className="stat-label">Faltando · canceladas</p><p className="stat-value num">{vm.saidas.cupons.faltando} · {vm.saidas.cupons.canceladas}</p></div>
                </div>
              )}
              <ul className="sieg-series">
                {vm.saidas.series.map(s => (
                  <li key={s.rotulo}>
                    <span className="sieg-serie-nome">{s.rotulo}</span>
                    <span className="fraco">{s.primeira} a {s.ultima} · {s.autorizadas} {s.autorizadas === 1 ? 'nota' : 'notas'} · {s.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    {s.faltando.length > 0 && <span className="sieg-falta">Faltam: {s.faltandoTexto}</span>}
                    {s.canceladas.length > 0 && <span className="fraco">Canceladas: {s.canceladasTexto}</span>}
                  </li>
                ))}
              </ul>
              {/* a situação na SEFAZ, pela VM (15/10/2026) */}
              <div className="sieg-situacao">
                <div className="sieg-situacao-topo">
                  <b>Situação na SEFAZ</b>
                  <span className="fraco">{vm.situacao?.trabalhando ? 'A VM está consultando: ' + vm.situacao.feitas + ' de ' + vm.situacao.total
                    : vm.situacao?.resultado ? 'Consultada em ' + vm.situacao.quando : 'Confere nota a nota se está autorizada, cancelada ou denegada.'}</span>
                  <span className="tarefas-barra-espaco" />
                  <button type="button" className="btn btn-outline" disabled={!!vm.situacao?.trabalhando} onClick={() => void vm.consultarSituacao()}>
                    {vm.situacao?.trabalhando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="checkCircle" />}{vm.situacao?.resultado ? 'Consultar de novo' : 'Consultar na SEFAZ'}
                  </button>
                </div>
                {vm.situacao?.trabalhando && <span className="tarefas-barra fgts-barra andando"><span style={{ width: Math.max(4, vm.situacao.pct) + '%' }} /></span>}
                {vm.situacao?.status === 'erro' && <p className="sieg-aviso"><Icone nome="alert" />{vm.situacao.erro}</p>}
                {vm.situacao?.resultado && (
                  <>
                    <div className="sieg-situacao-chips">
                      {vm.situacao.resumo.map(z => <span key={z.id} className={'sieg-situacao-chip ' + z.tom}><b className="num">{z.n.toLocaleString('pt-BR')}</b> {z.rotulo}</span>)}
                    </div>
                    {vm.situacao.resultado.divergentes.length > 0 ? (
                      <div className="table-wrap">
                        <table className="dp-tabela">
                          <thead><tr><th>Nota</th><th>No SIEG</th><th>Na SEFAZ</th><th>Valor</th><th>Motivo</th></tr></thead>
                          <tbody>
                            {vm.situacao.resultado.divergentes.map(d => (
                              <tr key={d.chave} title={d.chave}>
                                <td className="num">{d.tipo} {d.numero}{d.serie ? <span className="fraco"> · série {d.serie}</span> : null}</td>
                                <td>{d.sieg === 'cancelada' ? 'Cancelada' : 'Autorizada'}</td>
                                <td><span className={'badge ' + (d.sefaz === 'cancelada' ? 'badge-neutral' : 'badge-warn')}>{d.sefaz === 'nao-encontrada' ? 'Não consta' : d.sefaz === 'erro' ? 'Sem resposta' : d.sefaz.charAt(0).toUpperCase() + d.sefaz.slice(1)}</span></td>
                                <td className="num">{d.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="fraco">{d.motivo}{d.cStat ? ' (' + d.cStat + ')' : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : <p className="fraco" style={{ margin: 0 }}><Icone nome="check" /> Tudo bate com o SIEG.</p>}
                  </>
                )}
              </div>
              <p className="fraco sieg-quando">Baixadas do SIEG em {vm.saidas.quando}. O número que falta pode ser nota não enviada ao SIEG, inutilizada ou emitida fora.</p>
            </div>
          ) : vm.saidasCarregadas ? <p className="fraco">As saídas deste mês ainda não foram baixadas do SIEG.</p> : <Esqueleto linhas={2} />}
          {vm.pedido?.status === 'erro' && <p className="sieg-aviso"><Icone nome="alert" />O robô não conseguiu: {vm.pedido.erro}</p>}
          <div className="sieg-acoes">
            <button type="button" className="btn btn-outline" disabled={vm.pedindo || !!vm.desligado} onClick={() => void vm.baixar()}>
              {vm.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="download" />}
              {vm.pedindo ? (vm.pedido?.andamento || 'Baixando do SIEG…') : vm.saidas ? 'Atualizar do SIEG' : 'Baixar as saídas do SIEG'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
