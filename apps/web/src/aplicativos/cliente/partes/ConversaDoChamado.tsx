// A conversa de um chamado na Área do Cliente (Vitor, 16/10/2026): os balões na ordem, o do cliente à direita e o do
// escritório à esquerda; o escritório aparece sempre como "Escritório", nunca pelo nome de quem respondeu. Peça do
// catálogo (Listas).
import type { areaCliente as ac } from '@nads/core';

export function ConversaDoChamado({ mensagens }: { mensagens: ac.MensagemDoChamado[] }) {
  return (
    <ol className="cli-conversa" aria-label="Conversa">
      {mensagens.map((m, i) => (
        <li key={m.em + i} className={'cli-balao ' + (m.de === 'cliente' ? 'cli-balao-cliente' : 'cli-balao-escritorio')}>
          <span className="cli-balao-quem"><b>{m.autor}</b> · {new Date(m.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          <p>{m.texto}</p>
        </li>
      ))}
    </ol>
  );
}
