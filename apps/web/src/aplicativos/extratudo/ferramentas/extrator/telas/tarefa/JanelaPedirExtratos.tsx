// A janela do "Pedir extratos" (View do usePedirExtratos): para quem vai (do cadastro do Entregas), os
// bancos, a competência (+ "Mais competências") e a mensagem pronta; embaixo, Cancelar e Enviar.
import { Icone, LogoBanco, LogoGmail, LogoWhatsApp, useCarregando } from '@nads/ui';
import type { usePedirExtratos } from './usePedirExtratos';

export function JanelaPedirExtratos({ p }: { p: ReturnType<typeof usePedirExtratos> }) {
  useCarregando(!!p.canal && p.contato.carregando);
  if (!p.canal) return null;
  const email = p.canal === 'email';
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) p.fechar(); }}>
      <div className="modal pedir-modal" role="dialog" aria-modal="true" aria-label={email ? 'Pedir extratos por e-mail' : 'Pedir extratos por WhatsApp'}>
        <h3 className="pedir-titulo">
          <span className="pedir-app">{email ? <LogoGmail /> : <LogoWhatsApp />}</span>
          {email ? 'Pedir extratos por e-mail' : 'Pedir extratos por WhatsApp'}
          <button type="button" className="drawer-x pedir-x" aria-label="Fechar" onClick={p.fechar}><Icone nome="x" /></button>
        </h3>
        <div className="pedir-corpo">
          <div className="pedir-campo">
            <span className="pedir-rotulo">Para</span>
            {p.contato.erro ? <span className="pedir-erro">{p.contato.erro}</span> : !p.contato.dados ? <span className="hint">…</span> : email ? (
              p.emails.length === 0 ? <span className="pedir-erro">Sem e-mail no cadastro do Entregas.</span> : (
                <div className="pedir-opcoes">
                  {p.emails.map(e => (
                    <label key={e.email} className="pedir-opcao"><input type="checkbox" checked={e.marcado} onChange={() => p.alternarEmail(e.email)} />{e.email}</label>
                  ))}
                </div>
              )
            ) : p.whatsappOk ? <span>{p.telefone}</span> : <span className="pedir-erro">Sem telefone de WhatsApp no cadastro do Entregas{p.telefone ? ' (' + p.telefone + ')' : ''}.</span>}
          </div>

          <div className="pedir-campo">
            <span className="pedir-rotulo">Bancos</span>
            <div className="pedir-opcoes">
              {p.bancos.map(b => (
                <label key={b.id} className="pedir-opcao pedir-banco">
                  <input type="checkbox" checked={b.marcado} onChange={() => p.alternarBanco(b.id)} />
                  <span className="pedir-logo"><LogoBanco banco={b.marca} cor /></span>
                  <span>{b.nome}{b.conta && <span className="hint pedir-conta">{b.conta}</span>}</span>
                  {b.temExtrato && <span className="badge badge-ok pedir-tem">já tem</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="pedir-campo">
            <span className="pedir-rotulo">Competência</span>
            <div className="pedir-opcoes">
              <label className="pedir-opcao"><input type="checkbox" checked disabled />{p.competencia.rotulo}</label>
              <label className="pedir-opcao pedir-mais"><input type="checkbox" checked={p.mais} onChange={e => p.setMais(e.target.checked)} />Mais competências</label>
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
            <span className="pedir-rotulo">Mensagem</span>
            <div className="pedir-previa">
              {email && <p className="pedir-assunto">{p.assunto}</p>}
              <pre>{p.texto}</pre>
              {email && <p className="hint">Vai em HTML, com a cara do escritório, pelo robô do Entregas (Gmail do escritório).</p>}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          {p.enviando && <span className="hint pedir-andamento"><span className="btn-spinner" />{p.enviando}</span>}
          <button type="button" className="btn btn-outline" disabled={!!p.enviando} onClick={p.fechar}>Cancelar</button>
          {email ? (
            <button type="button" className="btn btn-primary" disabled={!p.pode} onClick={p.enviarEmail}>
              {p.exemplos ? 'Enviar (exemplo)' : 'Enviar e-mail'}
            </button>
          ) : (
            <a className={'btn btn-primary' + (p.pode ? '' : ' is-locked')} aria-disabled={!p.pode || undefined} href={p.pode ? p.linkWhatsApp : undefined}
              target="_blank" rel="noreferrer" onClick={e => { if (!p.pode) e.preventDefault(); else p.fechar(); }}>
              Abrir no WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
