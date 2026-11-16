// A conversa de um feedback (16/11/2026): as mensagens em balões (as minhas à direita, com o nome e a hora) e, embaixo, o
// campo e o botão. A mesma peça na janela do feedback do admin ("Perguntar") e na janela grande de quem mandou
// ("Responder"). Ctrl+Enter envia.
import { Esqueleto, Icone } from '@nads/ui';
import { useEffect, useId, useRef } from 'react';
import type { ConversaDoFeedbackVM } from './useConversaDoFeedback';

export function ConversaDoFeedback({ vm, vazia, rotulo, campo, fechada, grande = false, focar = false }: {
  vm: ConversaDoFeedbackVM;
  /** o que aparece sem mensagem nenhuma */
  vazia: string;
  /** o botão de enviar ("Perguntar", "Responder") */
  rotulo: string;
  /** o texto de dentro do campo */
  campo: string;
  /** o aviso no lugar do campo quando não dá para escrever */
  fechada: string;
  /** a janela grande: a lista ocupa a altura que sobra */
  grande?: boolean;
  /** já abre com o cursor no campo */
  focar?: boolean;
}) {
  const lista = useRef<HTMLDivElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const idCampo = useId();
  // a última mensagem sempre à vista, como num chat
  useEffect(() => { const l = lista.current; if (l) l.scrollTop = l.scrollHeight; }, [vm.mensagens.length]);
  useEffect(() => { if (focar && vm.podeEscrever) caixa.current?.focus(); }, [focar, vm.podeEscrever]);
  return (
    <div className={'conversa' + (grande ? ' conversa-grande' : '')}>
      <div className="conversa-lista" ref={lista} aria-live="polite">
        {vm.carregando ? <Esqueleto linhas={2} />
          : !vm.mensagens.length ? <p className="hint conversa-vazia">{vazia}</p>
            : vm.mensagens.map(m => (
              <div key={m.id} className={'conversa-item' + (m.minha ? ' minha' : '')}>
                <span className="conversa-quem">{m.nome}{m.quando && <span className="fraco"> · {m.quando}</span>}</span>
                <div className={'suporte-msg conversa-msg' + (m.minha ? ' suporte-eu' : '')}>{m.texto}</div>
              </div>
            ))}
      </div>
      {vm.podeEscrever ? (
        <div className="conversa-envio">
          <label htmlFor={idCampo} className="sr-only">{campo}</label>
          <textarea id={idCampo} ref={caixa} rows={grande ? 3 : 2} placeholder={campo} value={vm.texto} maxLength={vm.limite} disabled={vm.enviando}
            onChange={e => vm.setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); vm.enviar(); } }} />
          <div className="conversa-envio-linha">
            {vm.erro ? <p className="hint ext-neg conversa-erro" role="alert">{vm.erro}</p> : <span className="hint">Ctrl+Enter envia</span>}
            <button type="button" className="btn btn-primary" disabled={vm.enviando || !vm.texto.trim()} onClick={vm.enviar}>
              <Icone nome="mensagem" />{vm.enviando ? 'Enviando…' : rotulo}
            </button>
          </div>
        </div>
      ) : <p className="hint conversa-fechada">{fechada}</p>}
    </div>
  );
}
