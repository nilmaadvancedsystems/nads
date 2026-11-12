// A solicitação do cliente vista pelo escritório (11/11/2026, sem chat: "por existir o WhatsApp, não precisa de um chat;
// um sistema de requisições já serve"): o pedido do cliente (e o que ele somou depois, nos chamados de antes) e as
// respostas do escritório com o nome de quem respondeu, um bloco embaixo do outro. Peça do catálogo (Listas).
import type { MensagemNaEquipe } from '../../../dados/areaCliente';

const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export function PedidoDoChamado({ mensagens }: { mensagens: readonly MensagemNaEquipe[] }) {
  const doCliente = mensagens.filter(m => m.de === 'cliente');
  const respostas = mensagens.filter(m => m.de !== 'cliente');
  return (
    <div className="ac-pedido">
      <div>
        <h4>Pedido do cliente</h4>
        {doCliente.length ? doCliente.map((m, i) => <p key={m.em + i}>{m.texto}<span className="fraco"> · {quando(m.em)}</span></p>) : <p className="fraco">Sem texto.</p>}
      </div>
      <div>
        <h4>Resposta do escritório</h4>
        {respostas.length
          ? respostas.map((m, i) => <p key={m.em + i}>{m.texto}<span className="fraco"> · {m.autor || 'Escritório'}, {quando(m.em)}</span></p>)
          : <p className="fraco">Ainda sem resposta.</p>}
      </div>
    </div>
  );
}
