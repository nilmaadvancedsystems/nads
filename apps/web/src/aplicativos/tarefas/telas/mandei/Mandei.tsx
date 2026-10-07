// O Mandei na Tarefa (Vitor, 07/10/2026), com as peças do catálogo: a barra com o filtro (menu) e a busca, a tabela
// dos tickets (a linha abre o ticket embaixo), os selos da situação e o cartão do ticket com as respostas, os arquivos
// e os links. Respondido: o Resolver volta para a etapa da Tarefa.
import { mandei as m } from '@nads/core';
import { Alerta, Icone, MenuSuspenso } from '@nads/ui';
import { Fragment } from 'react';
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
      </div>
      <div className="table-wrap">
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
                  <td><span className={SELO[l.situacao]}>{l.rotulo}</span></td>
                </tr>
                {vm.detalhe?.id === l.id && (
                  <tr><td colSpan={pagina === 'central' ? 10 : 9}><Detalhe vm={vm} /></td></tr>
                )}
              </Fragment>
            ))}
            {!vm.linhas.length && <tr><td colSpan={10} className="hint">Nenhum ticket neste filtro. Os tickets saem das etapas (ex.: Clientes › Envio › Mandar pelo Mandei).</td></tr>}
          </tbody>
        </table>
      </div>
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
                  <td className="wrap">{it.opcao || it.texto ? <>{it.opcao && <b style={{ display: 'block' }}>{it.opcao}</b>}{it.texto}</> : <span className="hint">sem resposta</span>}</td>
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
        {d.arquivosSoltos.length > 0 && (
          <div className="btn-row">
            {d.arquivosSoltos.map(a => <button key={a.id} type="button" className="btn" onClick={() => vm.baixar(a)}><Icone nome="download" />{a.nome}</button>)}
          </div>
        )}
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Link</th><th>Enviado</th><th>Aberto pelo cliente</th><th>Vale até</th></tr></thead>
            <tbody>{d.links.map(l => <tr key={l.numero}><td>{l.numero}</td><td>{l.enviado}</td><td>{l.aberto}</td><td>{l.vence}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
