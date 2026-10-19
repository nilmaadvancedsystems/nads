// Uma linha da atividade recente na Visão geral da Área do Cliente ("melhora mais" de 17/10/2026, a linha do tempo dos
// portais de cliente): o ícone no círculo suave ligado ao de baixo por um fio fino, o que aconteceu ("Recebemos seu
// arquivo", "O escritório respondeu", a obrigação concluída), o detalhe embaixo (o nome do arquivo, o chamado) e quando, à
// direita ("hoje, 09:12", "ontem", "11/10"). Com onAbrir, a linha inteira abre (a resposta abre a conversa). Nada é
// cortado: o nome do arquivo quebra a linha. Peça do catálogo (Listas).
import { Icone, type NomeIcone } from '@nads/ui';

export type OrigemDaAtividade = 'envio' | 'resposta' | 'chamado' | 'feito' | 'documento';

const ICONE: Record<OrigemDaAtividade, NomeIcone> = { envio: 'upload', resposta: 'mensagem', chamado: 'mensagem', feito: 'check', documento: 'pastaAberta' };

export function LinhaDaAtividade({ origem, titulo, texto, quando, onAbrir }: { origem: OrigemDaAtividade; titulo: string; texto?: string; /** "hoje, 09:12" */ quando: string; onAbrir?: () => void }) {
  const miolo = (
    <>
      <span className={'cli-ativ-ico cli-ativ-' + origem} aria-hidden="true"><Icone nome={ICONE[origem]} width={14} height={14} /></span>
      <span className="cli-g-txt"><b>{titulo}</b>{texto && <span className="hint">{texto}</span>}</span>
      <span className="cli-ativ-quando">{quando}</span>
    </>
  );
  return (
    <li className="cli-atividade">
      {onAbrir ? <button type="button" className="cli-linha cli-ativ-linha" onClick={onAbrir}>{miolo}</button> : <div className="cli-linha cli-ativ-linha">{miolo}</div>}
    </li>
  );
}
