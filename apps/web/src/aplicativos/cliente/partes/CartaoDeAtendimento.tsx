// O cartão do atendimento na Visão geral da Área do Cliente (polida de 17/10/2026): o N da Nilma com "Seu atendimento" e
// o nome da equipe; embaixo, cada contato numa linha que já faz a ação — o WhatsApp abre a conversa, o e-mail abre o
// programa de e-mail e o telefone liga. O horário só entra quando o escritório tem. Com o banco o robô grava só o WhatsApp
// e o e-mail (sem telefone e sem horário): o cartão fica com as duas linhas, sem buraco. Peça do catálogo (Cartões).
import { Icone, type NomeIcone } from '@nads/ui';
import { MarcaDoEscritorio } from './MarcaDoEscritorio';

export interface ContatoDoEscritorio { equipe: string; horario?: string; whatsapp?: string; email?: string; telefone?: string }

interface Linha { icone: NomeIcone; rotulo: string; texto: string; href?: string; onClick?: () => void }

export function CartaoDeAtendimento({ contato: c, onWhatsapp }: { contato: ContatoDoEscritorio; /** abre a conversa; sem ele, o WhatsApp só aparece */ onWhatsapp?: () => void }) {
  const linhas: Linha[] = [];
  if (c.whatsapp) linhas.push({ icone: 'mensagem', rotulo: 'WhatsApp', texto: c.whatsapp, onClick: onWhatsapp });
  if (c.email) linhas.push({ icone: 'envelope', rotulo: 'E-mail', texto: c.email, href: 'mailto:' + c.email });
  if (c.telefone) linhas.push({ icone: 'telefone', rotulo: 'Telefone', texto: c.telefone, href: 'tel:' + c.telefone.replace(/\D/g, '') });
  const miolo = (l: Linha, acao: boolean) => (
    <>
      <span className="cli-contato-ico" aria-hidden="true"><Icone nome={l.icone} width={16} height={16} /></span>
      <span className="cli-contato-txt"><small>{l.rotulo}</small><span>{l.texto}</span></span>
      {acao && <Icone nome="chevronRight" width={16} height={16} />}
    </>
  );
  return (
    <section className="card cli-atendimento">
      <div className="cli-pessoa">
        <MarcaDoEscritorio tamanho={40} />
        <div><span className="hint">Seu atendimento</span><b>{c.equipe}</b></div>
      </div>
      {c.horario && <p className="cli-horario"><Icone nome="clock" width={16} height={16} />{c.horario}</p>}
      {linhas.length > 0 && (
        <ul className="cli-contatos">
          {linhas.map(l => (
            <li key={l.rotulo}>
              {l.onClick ? <button type="button" className="cli-contato" onClick={l.onClick}>{miolo(l, true)}</button>
                : l.href ? <a className="cli-contato" href={l.href}>{miolo(l, true)}</a>
                  : <span className="cli-contato">{miolo(l, false)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
