// O Mandei na Tarefa (Vitor, 07/10/2026), com as peças do catálogo: a barra com o filtro (menu) e a busca, a tabela
// dos tickets (a linha abre o ticket embaixo), os selos da situação e o cartão do ticket com as respostas, os arquivos
// e os links. Respondido: o Resolver volta para a etapa da Tarefa.
import { mandei as m } from '@nads/core';
import { Alerta, Icone, Interruptor, MenuSuspenso, Vazio } from '@nads/ui';
import { Fragment } from 'react';
import { NovoTicket } from './NovoTicket';
import { ROTULO_DO_FILTRO, useMandei, type FiltroDoMandei } from './useMandei';

type VM = ReturnType<typeof useMandei>;

const SELO: Record<m.SituacaoDoTicket, string> = {
  aguardando: 'badge badge-neutral', 'segundo-link': 'badge badge-warn', 'aguardando-2': 'badge badge-warn',
  ligar: 'badge ext-badge-falta', respondido: 'badge badge-conferido', resolvido: 'badge badge-ok',
};

export function Mandei({ pagina }: { pagina: 'meus' | 'central' }) {
  const vm = useMandei(pagina);
  return (
    <section>
      {vm.exemplo && (
        <div className="alerta-linha">
          <Alerta titulo="Dados de exemplo" texto="Os tickets ficam neste navegador e o e-mail não sai de verdade, até a regra do banco do Entregas ser publicada." />
        </div>
      )}
      {(vm.respondidos > 0 || vm.ligar > 0) && (
        <div className="alerta-linha" style={{ marginTop: 8 }}>
          <Alerta tom={vm.respondidos ? 'ok' : undefined}
            titulo={[vm.respondidos ? vm.respondidos + (vm.respondidos === 1 ? ' ticket respondido' : ' tickets respondidos') : '', vm.ligar ? vm.ligar + ' para ligar' : ''].filter(Boolean).join(' · ')}
            texto={vm.respondidos ? 'O cliente respondeu: abra o ticket, baixe os arquivos e clique em Resolver para voltar à tarefa.' : 'O 2º link venceu sem arquivo: ligue para o cliente.'} />
        </div>
      )}
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <MenuSuspenso rotulo={ROTULO_DO_FILTRO[vm.filtro]} className="btn btn-outline" dica="Filtrar os tickets"
          itens={(Object.keys(ROTULO_DO_FILTRO) as FiltroDoMandei[]).map(f => ({ rotulo: ROTULO_DO_FILTRO[f] + ' (' + vm.contagem[f] + ')', marcado: vm.filtro === f, onClick: () => vm.setFiltro(f) }))} />
        {/* "o botão de ocultar os que já fiz" (11/11/2026): os resolvidos somem da lista; fica guardado */}
        <span className="mandei-ocultar">
          <Interruptor ligado={vm.ocultarResolvidos} onMudar={vm.alternarResolvidos} rotulo="Ocultar os resolvidos" />
          <span>Ocultar resolvidos{vm.resolvidosOcultos > 0 ? ' (' + vm.resolvidosOcultos + ')' : ''}</span>
        </span>
        <span className="tarefas-barra-espaco" />
        {/* o ⚡ do modo desenvolvedor: o ticket de teste e as simulações do ticket aberto */}
        {vm.testes.length > 0 && (
          <MenuSuspenso rotulo="" icone="zap" className="btn btn-outline" direita largura={380} dica="Dados de teste (modo desenvolvedor)"
            itens={vm.testes.map(i => ({ rotulo: i.rotulo, icone: 'zap' as const, onClick: i.onClick }))} />
        )}
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar ticket, empresa ou e-mail" aria-label="Buscar ticket" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        {/* o ticket avulso, a partir de um modelo (11/11/2026) */}
        <button type="button" className="btn btn-primary" onClick={vm.abrirNovo}><Icone nome="plus" />Novo ticket</button>
      </div>
      {vm.novo && <NovoTicket aoFechar={vm.fecharNovo} aoCriar={vm.criado} />}
      {/* sem ticket, o vazio do catálogo no lugar da tabela (revisão da UI, 16/10/2026: no celular a frase ficava cortada
          dentro da linha da tabela larga) */}
      {!vm.linhas.length ? (
        <div className="table-wrap">
          <Vazio icone="mensagem" titulo={vm.resolvidosOcultos ? 'Tudo resolvido por aqui' : 'Nenhum ticket neste filtro'}
            texto={vm.resolvidosOcultos ? (vm.resolvidosOcultos === 1 ? '1 ticket resolvido está oculto.' : vm.resolvidosOcultos + ' tickets resolvidos estão ocultos.') : 'Os tickets saem das etapas (Clientes e Fornecedores › Envio) ou do Novo ticket.'}>
            {/* a saída do vazio (revisão da UI, 18/10/2026) */}
            {vm.resolvidosOcultos > 0 && <button type="button" className="btn btn-outline" onClick={vm.alternarResolvidos}>Mostrar os resolvidos</button>}
            {!vm.resolvidosOcultos && (vm.filtro !== 'todos' || vm.busca) && <button type="button" className="btn btn-outline" onClick={() => { vm.setFiltro('todos'); vm.setBusca(''); }}>Ver todos os tickets</button>}
          </Vazio>
        </div>
      ) : (
      // sem a rolagem própria (11/11/2026: "tem 2 barras, a da caixa principal e a da tela"): o ticket abre embaixo da linha e
      // a lista cresce com ele; só a página rola
      <div className="table-wrap mandei-central">
        <table className="table-compact">
          <thead>
            <tr>
              <th>Ticket</th><th>Empresa</th><th>Para</th>{pagina === 'central' && <th>Quem mandou</th>}
              <th>Enviado</th><th>Aberto</th><th>Respondido</th><th className="num">Arquivos</th><th>Vence</th><th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {vm.linhas.map(l => (
              <Fragment key={l.id}>
                <tr className="linha-abre" tabIndex={0} onClick={() => vm.abrir(l.id)} onKeyDown={e => { if (e.key === 'Enter') vm.abrir(l.id); }}
                  aria-expanded={vm.detalhe?.id === l.id}>
                  <td><b>{l.numero}</b></td>
                  <td className="wrap">{l.empresa}<span className="hint" style={{ display: 'block' }}>{l.assunto}</span></td>
                  <td>{l.para}</td>
                  {pagina === 'central' && <td>{l.por}</td>}
                  <td>{l.enviado || '—'}</td><td>{l.aberto || '—'}</td><td>{l.respondido || '—'}</td>
                  <td className="num">{l.arquivos || '—'}</td><td>{l.vence || '—'}</td>
                  <td>
                    <span className={SELO[l.situacao]}>{l.rotulo}</span>
                    {l.aRevisar > 0 && <span className="hint" style={{ display: 'block' }}>{l.aRevisar === 1 ? '1 resposta a revisar' : l.aRevisar + ' respostas a revisar'}</span>}
                  </td>
                </tr>
                {vm.detalhe?.id === l.id && (
                  <tr><td colSpan={pagina === 'central' ? 10 : 9}><Detalhe vm={vm} /></td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}

function Detalhe({ vm }: { vm: VM }) {
  const d = vm.detalhe;
  if (!d) return null;
  return (
    <div className="card" style={{ margin: '4px 0 8px' }}>
      <div className="card-head">
        <h3>{d.numero} · {d.empresa}</h3>
        <span className="card-head-ctl" style={{ display: 'inline-flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => vm.copiarLink(d.url)}><Icone nome="copiar" />Copiar link</button>
          <a className="btn" href={d.url} target="_blank" rel="noreferrer"><Icone nome="link" />Abrir o formulário</a>
          {d.podeResolver && <button type="button" className="btn btn-primary" onClick={vm.resolver}><Icone nome="check" />Resolver</button>}
        </span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p className="hint" style={{ margin: 0 }}>
          Para {d.para} · mandado por {d.por} em {d.criado} · {d.origem} · <span className={SELO[d.situacao]}>{d.rotulo}</span>
        </p>
        {d.situacao === 'ligar' && <Alerta titulo="Ligue para o cliente" texto="O 2º link venceu sem nenhum arquivo." />}
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Item</th><th>Nossa pergunta</th><th>Resposta</th><th>Arquivos</th></tr></thead>
            <tbody>
              {d.itens.map(it => (
                <tr key={it.id}>
                  <td className="wrap"><b>{it.titulo}</b>{it.valor && <span className="hint" style={{ display: 'block' }}>{it.valor}</span>}</td>
                  <td className="wrap">{it.detalhe ? <span className="msg-balao"><Icone nome="mensagem" />{it.detalhe}</span> : '—'}</td>
                  <td className="wrap">
                    {/* a resposta de cada linha (Vitor, 08/10/2026) */}
                    {it.respostas.map(x => <RespostaRevisada key={x.chave} x={x} vm={vm} />)}
                  </td>
                  <td className="wrap">
                    {it.arquivos.length ? it.arquivos.map(a => (
                      <button key={a.id} type="button" className="btn" style={{ margin: '2px 4px 2px 0' }} onClick={() => vm.baixar(a)}><Icone nome="download" />{a.nome}</button>
                    )) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* a revisão (11/11/2026): o pedido de novo vai num e-mail só, com um link novo de 3 dias úteis */}
        {(d.pedidos > 0 || d.revisar.length > 1) && (
          <div className="btn-row" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
            {d.revisar.length > 1 && <button type="button" className="btn" onClick={() => vm.aceitar(d.revisar)}><Icone nome="check" />Aceitar as {d.revisar.length} a revisar</button>}
            {d.pedidos > 0 && (
              <>
                <button type="button" className="btn btn-primary" disabled={d.faltaMotivo} onClick={vm.mandarPedidos}>
                  <Icone nome="envelope" />Pedir de novo ao cliente ({d.pedidos})
                </button>
                <span className="hint">{d.faltaMotivo ? 'Escreva o motivo de cada uma: é o que o cliente lê.' : 'Vai num link novo, que vale 3 dias úteis.'}</span>
              </>
            )}
          </div>
        )}
        {d.arquivosSoltos.length > 0 && (
          <div className="btn-row">
            {d.arquivosSoltos.map(a => <button key={a.id} type="button" className="btn" onClick={() => vm.baixar(a)}><Icone nome="download" />{a.nome}</button>)}
          </div>
        )}
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Link</th><th>Enviado</th><th>Aberto pelo cliente</th><th>Vale até</th></tr></thead>
            <tbody>{d.links.map((l, i) => <tr key={i}><td>{l.numero}</td><td>{l.enviado}</td><td>{l.aberto}</td><td>{l.vence}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mandei-rodape">
          {/* a nota interna (11/11/2026): o que a equipe combinou com o cliente; ele não vê */}
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Notas internas</h4>
            <div className="field" style={{ margin: 0 }}>
              <textarea rows={2} value={vm.nota} placeholder="Ex.: liguei, vai mandar amanhã (o cliente não vê)" aria-label="Nota interna" onChange={e => vm.setNota(e.target.value)} />
            </div>
            <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 8 }}>
              <button type="button" className="btn" disabled={!vm.nota.trim()} onClick={vm.guardarNota}>Guardar nota</button>
            </div>
            {d.notas.map(n => <p key={n.id} className="hint" style={{ margin: '8px 0 0' }}><b>{n.por}</b> · {n.em}<br />{n.texto}</p>)}
          </div>
          {/* o histórico (11/11/2026): o caminho do ticket, o mais novo em cima */}
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Histórico</h4>
            {d.historico.length ? (
              <ul className="mandei-historico">
                {d.historico.map(e => <li key={e.id}><span className="hint">{e.em}</span> {e.rotulo}{e.texto ? ' · ' + e.texto : ''}{e.por ? ' · ' + e.por : ''}</li>)}
              </ul>
            ) : <p className="hint" style={{ margin: 0 }}>Ticket de antes do histórico.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

type Resposta = NonNullable<VM['detalhe']>['itens'][number]['respostas'][number];

/** Uma resposta com a revisão dela: aceita, pedida de novo, ou os botões Aceitar e Pedir de novo (com o motivo). */
function RespostaRevisada({ x, vm }: { x: Resposta; vm: VM }) {
  return (
    <span style={{ display: 'block', marginBottom: 8 }}>
      {x.linha && <span className="hint" style={{ display: 'block' }}>{x.linha}</span>}
      {x.opcao || x.texto ? <>{x.opcao && <b>{x.opcao}</b>}{x.opcao && x.texto ? ': ' : ''}{x.texto}</> : <span className="hint">{x.revisao === 'refazer' ? 'esperando a nova resposta' : 'sem resposta'}</span>}
      <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {x.revisao === 'aceita' && <span className="badge badge-ok" title={'Aceita por ' + x.por}>Aceita</span>}
        {x.revisao === 'refazer' && <span className="badge badge-warn" title={'Pedida por ' + x.por}>Pedida de novo: {x.motivo}</span>}
        {x.revisao === 'revisar' && x.pedido === null && <>
          <button type="button" className="btn mandei-acao" onClick={() => vm.aceitar([x.chave])}><Icone nome="check" />Aceitar</button>
          <button type="button" className="btn mandei-acao" onClick={() => vm.marcarPedido(x.chave)}><Icone nome="repeat" />Pedir de novo</button>
        </>}
      </span>
      {x.pedido !== null && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <label className="busca-curta" style={{ flex: 1, minWidth: 160, width: 'auto' }}>
            <Icone nome="lapis" />
            <input type="text" value={x.pedido} placeholder="O motivo (o cliente lê)" aria-label={'O motivo de pedir de novo' + (x.linha ? ': ' + x.linha : '')}
              onChange={e => vm.escreverMotivo(x.chave, e.target.value)} />
          </label>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => vm.marcarPedido(x.chave)} title="Não pedir de novo" aria-label="Não pedir de novo"><Icone nome="x" /></button>
        </span>
      )}
    </span>
  );
}
