// A aba Chamados da Área do Cliente (Vitor, 16/10/2026): a lista de conversas com o escritório, abrir um chamado novo
// (assunto + texto) e responder dentro da conversa.
import { Icone } from '@nads/ui';
import { ConversaDoChamado } from '../partes/ConversaDoChamado';
import { useChamados } from './useChamados';
import type { DaCasca } from './useAreaCliente';

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  return (
    <div className="cli-chamados">
      <section className="card">
        <h3>Seus chamados</h3>
        <div className="btn-row" style={{ marginTop: 0, marginBottom: 12 }}>
          <button type="button" className="btn btn-primary" onClick={vm.comecarNovo}><Icone nome="plus" width={16} height={16} />Abrir um chamado</button>
        </div>
        {vm.chamados.length ? (
          <ul className="cli-lista">
            {vm.chamados.map(c => (
              <li key={c.id}>
                <button type="button" className={'cli-item-chamado' + (vm.aberto?.id === c.id ? ' on' : '')} onClick={() => vm.abrir(c.id)} aria-pressed={vm.aberto?.id === c.id}>
                  <Icone nome="mensagem" width={16} height={16} />
                  <span><b>{c.titulo}</b><span className="hint">{vm.rotuloDoTipo(c.tipo)}</span></span>
                  <span className={'badge ' + (c.situacao === 'respondido' ? 'badge-ok' : 'badge-neutral')}>{vm.rotuloDaSituacao[c.situacao]}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="hint">Você ainda não abriu nenhum chamado.</p>}
      </section>

      {vm.novo && (
        <section className="card">
          <h3>Novo chamado</h3>
          <div className="field">
            <label htmlFor="cli-tipo">Sobre o quê?</label>
            <select id="cli-tipo" value={vm.tipo} onChange={e => vm.mudarTipo(e.target.value)}>
              <option value="" disabled>Escolha o assunto</option>
              {vm.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cli-texto">Conte o que você precisa</label>
            <textarea id="cli-texto" rows={5} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)} placeholder="Escreva do seu jeito. Se for sobre um funcionário, diga o nome." />
          </div>
          {vm.erro && <p className="hint ext-neg" role="alert">{vm.erro}</p>}
          <div className="btn-row">
            <button type="button" className="btn" onClick={vm.cancelarNovo}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={vm.criar}>Enviar chamado</button>
          </div>
        </section>
      )}

      {vm.aberto && (
        <section className="card">
          <h3>{vm.aberto.titulo}</h3>
          <ConversaDoChamado mensagens={vm.aberto.mensagens} />
          {vm.aceitaResposta ? (
            <div className="field" style={{ marginTop: 16 }}>
              <label htmlFor="cli-resposta">Sua resposta</label>
              <textarea id="cli-resposta" rows={3} value={vm.resposta} onChange={e => vm.mudarResposta(e.target.value)} placeholder="Escreva aqui" />
              <div className="btn-row">
                <span />
                <button type="button" className="btn btn-primary" disabled={vm.enviando || !vm.resposta.trim()} onClick={vm.responder}>Responder</button>
              </div>
            </div>
          ) : <p className="hint">Este chamado foi concluído. Para outro assunto, abra um chamado novo.</p>}
        </section>
      )}
    </div>
  );
}
