// A conversa de um chamado vista pelo escritório (Vitor, 16/10/2026): os balões na ordem, o do cliente à esquerda e o do
// escritório (com o nome de quem respondeu) à direita. Peça do catálogo (Listas).
import type { MensagemNaEquipe } from '../../../dados/areaCliente';

const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export function ConversaDoEscritorio({ mensagens }: { mensagens: readonly MensagemNaEquipe[] }) {
  return (
    <ol className="ac-conversa" aria-label="Conversa do chamado">
      {mensagens.map((m, i) => (
        <li key={m.em + i} className={'ac-balao ' + (m.de === 'cliente' ? 'ac-balao-cliente' : 'ac-balao-escritorio')}>
          <span className="ac-balao-quem"><b>{m.de === 'cliente' ? 'Cliente' : m.autor || 'Escritório'}</b> · {quando(m.em)}</span>
          <p>{m.texto}</p>
        </li>
      ))}
      {!mensagens.length && <li className="fraco">Sem mensagens.</li>}
    </ol>
  );
}
