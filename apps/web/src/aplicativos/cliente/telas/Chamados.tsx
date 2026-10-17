// As Solicitações da Área do Cliente (Vitor, 16/10/2026): pedir algo ao escritório (o assunto e o texto) e, embaixo, as
// conversas — clicar abre a conversa ali mesmo, com o campo de responder.
import { ConversaDoChamado } from '../partes/ConversaDoChamado';
import { useChamados } from './useChamados';
import type { DaCasca } from './useAreaCliente';

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  return (
    <>
      <div className="cli-form">
        <div className="field">
          <label htmlFor="cli-tipo">Assunto</label>
          <select id="cli-tipo" value={vm.tipo} onChange={e => vm.mudarTipo(e.target.value)}>
            <option value="" disabled>Escolha</option>
            {vm.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
        </div>
        <div className="field cli-largo">
          <label htmlFor="cli-mensagem">O que você precisa</label>
          <textarea id="cli-mensagem" rows={4} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)} placeholder="Escreva do seu jeito. Se for sobre um funcionário, diga o nome." />
        </div>
      </div>
      {vm.erro && <p className="cli-erro" role="alert">{vm.erro}</p>}
      <div className="cli-acao">
        <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={() => void vm.mandar()}>Enviar</button>
      </div>

      <h2 className="cli-secao">Conversas</h2>
      {vm.chamados.length ? (
        <ul>
          {vm.chamados.map(c => {
            const ultima = vm.ultimaMensagem(c);
            const aberta = vm.aberto?.id === c.id;
            return (
              <li key={c.id}>
                <button type="button" className="cli-conversa-linha" aria-expanded={aberta} onClick={() => vm.alternar(c.id)}>
                  <span className="cli-linha-txt">
                    <b>{c.titulo}</b>
                    {ultima && <span className="hint" style={{ display: 'block' }}>{ultima.de === 'escritorio' ? 'Escritório' : 'Você'}, {vm.quando(ultima.em)}: {ultima.texto.split('\n')[0]}</span>}
                  </span>
                  <span className={'cli-situacao' + (c.situacao === 'respondido' ? ' cli-respondido' : '')}>{vm.situacao(c)}</span>
                </button>
                {aberta && vm.aberto && (
                  <div className="cli-conversa-aberta">
                    <ConversaDoChamado mensagens={vm.aberto.mensagens} />
                    {vm.aceitaResposta ? (
                      <>
                        <div className="field" style={{ margin: '16px 0 0' }}>
                          <label htmlFor="cli-resposta">Responder</label>
                          <textarea id="cli-resposta" rows={2} value={vm.resposta} onChange={e => vm.mudarResposta(e.target.value)} />
                        </div>
                        <div className="cli-acao" style={{ marginTop: 8 }}>
                          <button type="button" className="btn btn-primary" disabled={vm.enviando || !vm.resposta.trim()} onClick={() => void vm.responder()}>Responder</button>
                        </div>
                      </>
                    ) : <p className="hint" style={{ marginTop: 12 }}>Conversa encerrada. Para outro assunto, faça um pedido novo.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : <p className="cli-vazio">Nenhuma conversa ainda.</p>}
    </>
  );
}
