// A linha do tempo da tarefa (28/10/2026): o Histórico (cada mudança: criou, delegou, mudou o status, o prazo, anexou…) e
// os Pareceres (os comentários, com o texto inteiro). O mais novo em cima; quem e quando na linha de cima, o texto embaixo.
import { Vazio } from '@nads/ui';

export interface ItemDaLinhaDoTempo { id: string; por: string; quando: string; texto: string }

export function LinhaDoTempoDaTarefa({ itens, vazio, comentario }: { itens: readonly ItemDaLinhaDoTempo[]; vazio: string; comentario?: boolean }) {
  if (!itens.length) return <Vazio compacto icone={comentario ? 'mensagem' : 'clock'} titulo={vazio} />;
  return (
    <ol className={'tdl-tempo' + (comentario ? ' tdl-pareceres' : '')}>
      {itens.map(i => (
        <li key={i.id} className="tdl-tempo-item">
          <span className="tdl-tempo-ponto" aria-hidden="true" />
          <div className="tdl-tempo-corpo">
            <p className="tdl-tempo-quem"><b>{i.por || '—'}</b><span className="fraco">{i.quando}</span></p>
            <p className="tdl-tempo-texto">{i.texto}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
