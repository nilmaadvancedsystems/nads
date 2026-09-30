// A janela do "Pedir extratos" (View do usePedirExtratos), larga: à esquerda o pedido — para quem (do
// cadastro do Entregas), os documentos (+ outro), a competência (+ "Mais competências"), o prazo e o WhatsApp
// opcional com a mensagem que a pessoa digita; à direita, o e-mail em HTML como o cliente vai ver.
import { Icone, LogoBanco, LogoGmail, LogoWhatsApp, useCarregando } from '@nads/ui';
import { useState } from 'react';
import type { usePedirExtratos } from './usePedirExtratos';

type P = ReturnType<typeof usePedirExtratos>;

export function JanelaPedirExtratos({ p }: { p: P }) {
  useCarregando(p.aberto && p.contato.carregando);
  const [outro, setOutro] = useState('');
  if (!p.aberto) return null;
  const adicionar = () => { p.adicionarDocumento(outro); setOutro(''); };
  const enviar = () => {
    // o WhatsApp abre já (no clique; depois o navegador bloquearia), o e-mail vai para a fila do robô
    if (p.whatsapp.ligado && p.whatsapp.ok) window.open(p.whatsapp.link, '_blank');
    p.enviar();
  };
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) p.fechar(); }}>
      <div className="modal pedir-modal" role="dialog" aria-modal="true" aria-label="Pedir documentos">
        <h3 className="pedir-titulo">
          <span className="pedir-app"><LogoGmail /></span>
          Pedir documentos por e-mail
          <button type="button" className="drawer-x pedir-x" aria-label="Fechar" onClick={p.fechar}><Icone nome="x" /></button>
        </h3>

        <div className="pedir-grade-2">
          <div className="pedir-corpo">
            <div className="pedir-campo">
              <span className="pedir-rotulo">Para</span>
              {p.contato.erro ? <span className="pedir-erro">{p.contato.erro}</span> : !p.contato.dados ? <span className="hint">…</span> : p.emails.length === 0 ? (
                <span className="pedir-erro">Sem e-mail no cadastro do Entregas.</span>
              ) : (
                <div className="pedir-opcoes">
                  {p.emails.map(e => (
                    <label key={e.email} className="pedir-opcao"><input type="checkbox" checked={e.marcado} onChange={() => p.alternarEmail(e.email)} />{e.email}</label>
                  ))}
                </div>
              )}
            </div>

            <div className="pedir-campo">
              <span className="pedir-rotulo">Competências</span>
              <div className="pedir-opcoes">
                <label className="pedir-opcao"><input type="checkbox" checked disabled />{p.competencia.rotulo}</label>
                <label className="pedir-opcao"><input type="checkbox" checked={p.mais} onChange={e => p.setMais(e.target.checked)} />Mais competências</label>
                {p.mais && (
                  <div className="pedir-grade">
                    {p.outrasCompetencias.map(c => (
                      <label key={c.valor} className="pedir-opcao"><input type="checkbox" checked={c.marcado} onChange={() => p.alternarCompetencia(c.valor)} />{c.rotulo}</label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pedir-campo">
              <span className="pedir-rotulo">Documentos</span>
              <div className="pedir-opcoes">
                {p.documentos.map(d => p.variasCompetencias ? (
                  // várias competências: o documento e uma caixinha por mês
                  <div key={d.id} className="pedir-doc-varias">
                    <span className="pedir-doc-titulo">
                      {d.banco && <span className="pedir-logo"><LogoBanco banco={d.banco} cor /></span>}
                      <span className="pedir-doc-nome">{d.nome}</span>
                    </span>
                    <span className="pedir-comps">
                      {d.competencias.map(c => (
                        <label key={c.valor} className={'pedir-comp' + (c.marcado ? ' marcado' : '') + (c.travado ? ' travado' : '')} title={c.travado ? 'Já está ' + (c.travado === 'importado' ? 'importado' : 'no Drive') + ': não precisa pedir' : undefined}>
                          <input type="checkbox" checked={c.marcado} disabled={!!c.travado} onChange={() => p.alternarDocumento(d.id, c.valor)} />
                          {c.rotulo}{c.travado && <span className="pedir-comp-tag">{c.travado}</span>}
                        </label>
                      ))}
                    </span>
                  </div>
                ) : (
                  <label key={d.id} className={'pedir-opcao pedir-doc' + (d.competencias[0].travado ? ' travado' : '')}
                    title={d.competencias[0].travado ? 'Já está ' + (d.competencias[0].travado === 'importado' ? 'importado' : 'no Drive') + ': não precisa pedir' : undefined}>
                    <input type="checkbox" checked={d.competencias[0].marcado} disabled={!!d.competencias[0].travado} onChange={() => p.alternarDocumento(d.id, d.competencias[0].valor)} />
                    {d.banco && <span className="pedir-logo"><LogoBanco banco={d.banco} cor /></span>}
                    <span className="pedir-doc-nome">{d.nome}</span>
                    {d.competencias[0].travado && <span className={'badge pedir-tem ' + (d.competencias[0].travado === 'importado' ? 'badge-ok' : 'badge-neutral')}>{d.competencias[0].travado}</span>}
                  </label>
                ))}
                <form className="pedir-outro" onSubmit={e => { e.preventDefault(); adicionar(); }}>
                  <input type="text" placeholder="Outro documento (ex.: Relatórios da LJ)" value={outro} onChange={e => setOutro(e.target.value)} />
                  <button type="submit" className="btn btn-outline btn-sm" disabled={!outro.trim()}><Icone nome="plus" />Adicionar</button>
                </form>
              </div>
            </div>

            <div className="pedir-campo">
              <label className="pedir-rotulo" htmlFor="pedirPrazo">Prazo</label>
              <input id="pedirPrazo" type="date" className="pedir-prazo" value={p.prazo} onChange={e => p.setPrazo(e.target.value)} />
            </div>

            <div className="pedir-campo">
              <span className="pedir-rotulo">WhatsApp</span>
              <div className="pedir-opcoes">
                <label className={'pedir-opcao' + (p.whatsapp.ok ? '' : ' is-locked')}>
                  <input type="checkbox" checked={p.whatsapp.ligado} disabled={!p.whatsapp.ok} onChange={e => p.whatsapp.ligar(e.target.checked)} />
                  <span className="pedir-app"><LogoWhatsApp /></span>
                  Mandar também pelo WhatsApp{p.whatsapp.telefone ? ' · ' + p.whatsapp.telefone : ''}
                </label>
                {!p.whatsapp.ok && p.contato.dados && <span className="hint">Sem telefone de WhatsApp no cadastro do Entregas.</span>}
                {p.whatsapp.ligado && (
                  <>
                    <textarea className="pedir-whats" rows={8} value={p.whatsapp.texto} onChange={e => p.whatsapp.escrever(e.target.value)} aria-label="Mensagem do WhatsApp" />
                    {p.whatsapp.editado && <button type="button" className="btn btn-ghost btn-sm pedir-refazer" onClick={p.whatsapp.refazer}>Voltar à mensagem pronta</button>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="pedir-previa-email">
            <p className="pedir-assunto"><span className="hint">Assunto</span>{p.assunto}</p>
            <iframe title="Prévia do e-mail" srcDoc={p.html} sandbox="allow-same-origin" />
          </div>
        </div>

        <div className="modal-actions">
          {p.enviando && <span className="hint pedir-andamento"><span className="btn-spinner" />{p.enviando}</span>}
          <button type="button" className="btn btn-outline" disabled={!!p.enviando} onClick={p.fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!p.pode} onClick={enviar}>
            {p.exemplos ? 'Enviar (exemplo)' : p.whatsapp.ligado ? 'Enviar e-mail e WhatsApp' : 'Enviar e-mail'}
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = { pendente: 'Na fila do robô', processando: 'Enviando', enviado: 'Enviado', erro: 'Erro', sumiu: 'Não achado na fila' };
const COR: Record<string, string> = { enviado: 'badge-ok', erro: 'badge-bad', sumiu: 'badge-neutral', pendente: 'badge-warn', processando: 'badge-warn' };
const quando = (iso: string) => { const d = new Date(iso); return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

/** O histórico dos pedidos da empresa: quando, quem, o que, para quem e como está o e-mail. */
export function JanelaHistoricoDePedidos({ p }: { p: P }) {
  if (!p.historico.aberto) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) p.fecharHistorico(); }}>
      <div className="modal pedir-historico" role="dialog" aria-modal="true" aria-label="Histórico dos pedidos">
        <h3 className="pedir-titulo">
          <Icone nome="clock" />Histórico dos pedidos
          <button type="button" className="drawer-x pedir-x" aria-label="Fechar" onClick={p.fecharHistorico}><Icone nome="x" /></button>
        </h3>
        <div className="pedir-hist-lista">
          {p.historico.erro && <p className="pedir-erro">{p.historico.erro}</p>}
          {p.pedidos.length === 0 ? <p className="empty">Nenhum pedido feito para esta empresa ainda.</p> : p.pedidos.map(r => (
            <div key={r.id} className="pedir-hist-item">
              <div className="pedir-hist-topo">
                <b>{quando(r.em)}</b><span className="hint">por {r.por}</span>
                <span className="pedir-hist-comp">{r.competencias.map(c => <span key={c} className="badge">{c.slice(5) + '/' + c.slice(0, 4)}</span>)}</span>
              </div>
              <ul className="pedir-hist-docs">{r.documentos.map(d => <li key={d}>{d}</li>)}</ul>
              <div className="pedir-hist-canais">
                {r.email && (
                  <span className="pedir-hist-canal">
                    <span className="pedir-app"><LogoGmail /></span>{r.email.para.join(', ')}
                    {r.email.solicitacoes.map(id => {
                      const s = p.historico.situacoes[id]?.status;
                      return <span key={id} className={'badge ' + (s ? COR[s] : 'badge-neutral')} title={p.historico.situacoes[id]?.erro}>{s ? STATUS[s] : '…'}</span>;
                    })}
                  </span>
                )}
                {r.whatsapp && <span className="pedir-hist-canal"><span className="pedir-app"><LogoWhatsApp /></span>{r.whatsapp.telefone}<span className="badge badge-neutral">Aberto no WhatsApp</span></span>}
                {r.prazo && <span className="hint">Prazo: até {r.prazo}</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="hint pedir-hist-nota">Visualizado: o Gmail não avisa quando o cliente abre o e-mail. Por enquanto, a situação mostra se o robô enviou.</p>
      </div>
    </div>
  );
}
