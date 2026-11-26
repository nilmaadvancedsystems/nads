// O pedido e as respostas da solicitação vistos pela equipe (26/11/2026: "esse chat ta MUITO feio"): o mesmo desenho da
// solicitação na Área do Cliente (cliente/telas/Chamados.tsx, cli-sol-tempo), para a equipe ver como o cliente vê. Uma linha
// do tempo: a bolinha (a logo ou as iniciais da empresa; o N do escritório), o nome, o selo "Escritório", a hora e o balão
// (o do escritório em verde). Sem chat: o cliente conversa pelo WhatsApp.
import { MarcaN } from '@nads/ui';
import type { MensagemNaEquipe } from '../../../dados/areaCliente';

const quando = (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const iniciais = (nome: string) => nome.trim().split(/\s+/).filter(p => p.length > 2).slice(0, 2).map(p => p[0]).join('').toUpperCase() || nome.trim().slice(0, 1).toUpperCase();

export function ConversaDaSolicitacao({ mensagens, empresa, logo }: { mensagens: readonly MensagemNaEquipe[]; empresa: string; logo?: string }) {
  const temResposta = mensagens.some(m => m.de !== 'cliente');
  return (
    <ol className="area-sol-tempo">
      {mensagens.map((m, i) => m.de === 'cliente' ? (
        <li key={m.em + i} className="area-sol-evento cliente">
          <span className="area-sol-quem" aria-hidden="true">{logo ? <img src={logo} alt="" /> : iniciais(empresa)}</span>
          <div className="area-sol-fala">
            <p className="area-sol-fala-topo"><b>Cliente</b><span className="hint">{quando(m.em)}</span></p>
            <p className="area-sol-texto">{m.texto}</p>
          </div>
        </li>
      ) : (
        <li key={m.em + i} className="area-sol-evento escritorio">
          <span className="area-sol-quem area-sol-marca" aria-hidden="true"><MarcaN /></span>
          <div className="area-sol-fala">
            <p className="area-sol-fala-topo"><b>{m.autor || 'Escritório'}</b><span className="area-sol-do-escritorio">Escritório</span><span className="hint">{quando(m.em)}</span></p>
            <p className="area-sol-texto">{m.texto}</p>
          </div>
        </li>
      ))}
      {!temResposta && (
        <li className="area-sol-evento esperando">
          <span className="area-sol-quem area-sol-marca" aria-hidden="true"><MarcaN /></span>
          <div className="area-sol-fala"><p className="hint">Ainda sem resposta do escritório.</p></div>
        </li>
      )}
    </ol>
  );
}
