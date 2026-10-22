// A lista com o detalhe ao lado (Admin › Arquivador, 22/10/2026; o dual-pane do Docupath): à esquerda, uma linha por
// arquivo — o ícone do formato, o nome, o apoio (o cliente e o tipo, ou o motivo), o selo, a confiança e a hora; ao clicar,
// o painel da direita abre o detalhe (o porquê). No celular e no tablet o detalhe abre por cima da lista, com o Fechar
// (e o Esc fecha).
// Peça do catálogo (Listas). Sem animação.
import { BotaoFechar, IconeDeArquivo, type FormatoDoArquivo } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';

export type TomDaLinha = 'ok' | 'aviso' | 'erro' | 'neutro';
export interface LinhaDaLista {
  id: string; nome: string; formato: FormatoDoArquivo; apoio: string; selo: { rotulo: string; tom: TomDaLinha };
  /** "96%" ou '' */
  confianca: string; tomConfianca: TomDaLinha; hora: string;
}
const SELO: Record<TomDaLinha, string> = { ok: 'badge-ok', aviso: 'badge-warn', erro: 'badge-bad', neutro: 'badge-neutral' };

/** Uma linha (também usada sozinha, na lista "Ao vivo" da Visão geral). */
export function LinhaDoArquivo({ l, ativa, onAbrir }: { l: LinhaDaLista; ativa?: boolean; onAbrir?: (id: string) => void }) {
  const corpo = (
    <>
      <IconeDeArquivo formato={l.formato} tamanho={32} />
      <span className="arq-linha-texto">
        <b>{l.nome}</b>
        <span className="fraco">{l.apoio}</span>
      </span>
      <span className="arq-linha-fim">
        <span className={'badge badge-suave ' + SELO[l.selo.tom]}>{l.selo.rotulo}</span>
        <span className="arq-linha-meta fraco">
          {l.confianca && <span className={'arq-confianca ' + l.tomConfianca}>{l.confianca}</span>}
          <span className="num">{l.hora}</span>
        </span>
      </span>
    </>
  );
  if (!onAbrir) return <li className="arq-linha">{corpo}</li>;
  return (
    <li><button type="button" className={'arq-linha' + (ativa ? ' ativa' : '')} aria-pressed={!!ativa} onClick={() => onAbrir(l.id)}>{corpo}</button></li>
  );
}

export function ListaComDetalhe({ linhas, aberto, onAbrir, onFechar, detalhe, vazio, rotulo, pe }: {
  linhas: readonly LinhaDaLista[];
  /** o id da linha aberta ('' nenhuma) */
  aberto: string;
  onAbrir: (id: string) => void;
  onFechar: () => void;
  /** o detalhe da linha aberta (null: o convite para clicar) */
  detalhe: ReactNode | null;
  vazio: ReactNode;
  rotulo: string;
  /** embaixo da lista ("e mais 120…") */
  pe?: ReactNode;
}) {
  const comDetalhe = !!detalhe;
  useEffect(() => {
    if (!comDetalhe) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [comDetalhe, onFechar]);
  if (!linhas.length) return <>{vazio}</>;
  return (
    <div className={'arq-duplo' + (detalhe ? ' com-detalhe' : '')}>
      <div className="arq-duplo-lista">
        <ul className="arq-linhas" aria-label={rotulo}>
          {linhas.map(l => <LinhaDoArquivo key={l.id} l={l} ativa={l.id === aberto} onAbrir={onAbrir} />)}
        </ul>
        {pe}
      </div>
      <aside className="arq-duplo-detalhe" aria-label="Detalhe do arquivo">
        {detalhe ? (
          <>
            <div className="arq-duplo-fechar"><BotaoFechar onClick={onFechar} /></div>
            {detalhe}
          </>
        ) : <p className="arq-duplo-convite fraco">Clique num arquivo para ver o que o robô fez e por quê.</p>}
      </aside>
    </div>
  );
}
