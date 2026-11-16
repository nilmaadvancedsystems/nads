// A janela grande da conversa, na tela de quem mandou o feedback (Vitor, 16/11/2026: "um chat bem grande na tela, que depois
// vai pro balão"): o suporte perguntou, ela abre sozinha por cima de tudo, com o que a pessoa mandou, a conversa e o campo
// de responder. Fechada ("Responder depois" ou o ×), a conversa continua no balão do suporte, de onde abre de novo.
import { BotaoFechar } from '@nads/ui';
import { useRef } from 'react';
import { useJanela } from '@nads/ui';
import { ConversaDoFeedback } from '../feedback/ConversaDoFeedback';
import { useConversaDoFeedback } from '../feedback/useConversaDoFeedback';
import type { ConversaAberta } from './useBalaoDoSuporte';

export function JanelaDaConversa({ c, fechar }: { c: ConversaAberta; fechar: () => void }) {
  const vm = useConversaDoFeedback(c.id, 'autor', c.status, c.conversa);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="pessoal-janela conversa-janela" role="dialog" aria-modal="true" aria-label="Conversa com o suporte">
        <header className="pessoal-topo">
          <h2>{c.esperando ? 'O suporte tem uma pergunta' : 'Conversa com o suporte'}</h2>
          {c.pedido && <span className="fraco">{c.pedido}</span>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-ghost" title="Fecha; a conversa continua no balão do suporte, no canto da tela" onClick={fechar}>Responder depois</button>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="conversa-janela-corpo">
          <section className="feedback-bloco conversa-contexto">
            <p className="feedback-rotulo">O que você mandou{c.quando ? ' em ' + c.quando : ''}</p>
            <p className="feedback-txt">{c.texto}</p>
          </section>
          <ConversaDoFeedback vm={vm} grande focar rotulo="Responder" campo="Escreva a sua resposta"
            vazia="Ainda sem mensagens." fechada="Este pedido já foi resolvido: a conversa fica só para ler." />
        </div>
      </div>
    </div>
  );
}
