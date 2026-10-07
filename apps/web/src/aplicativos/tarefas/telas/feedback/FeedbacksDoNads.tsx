// Os feedbacks da equipe (Vitor, 07/10/2026: "abra uma janela flutuante", aberta no pé da gaveta ☰, junto da versão):
// à esquerda Novos / Vistos / Feitos / Todos; à direita cada feedback com o print (clicar amplia), o texto, quem,
// quando, a tela e a versão; Visto e Feito.
import { Esqueleto, Icone } from '@nads/ui';
import { useEffect } from 'react';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import type { SituacaoDoFeedback } from '../../dados/feedback';
import { useFeedbacks } from './useFeedbacks';

const SELO = { novo: 'badge-warn', visto: 'badge-neutral', feito: 'badge-ok' } as const;
const NOME = { novo: 'Novo', visto: 'Visto', feito: 'Feito' } as const;
const ICONE = { novo: 'envelope', visto: 'olho', feito: 'check', '': 'relatorio' } as const;
const TODOS = 'todos';

export function JanelaDosFeedbacks({ fechar }: { fechar: () => void }) {
  const vm = useFeedbacks();
  const topicos: TopicoDaJanela<string>[] = vm.filtros.map(f => ({ id: f.valor || TODOS, rotulo: f.rotulo, icone: ICONE[f.valor], contador: f.qtd }));
  return (
    <JanelaLateral rotulo="Feedbacks" topicos={topicos} topico={vm.filtro || TODOS} mudar={id => vm.setFiltro(id === TODOS ? '' : id as SituacaoDoFeedback)} fechar={fechar}
      classe="feedbacks-janela" resumo={<div className="usuario-quem"><b>Feedbacks</b></div>}>
      {vm.carregando ? <Esqueleto linhas={6} /> : !vm.lista.length ? <p className="empty">Nenhum feedback.</p> : (
        <ul className="feedback-lista">
          {vm.lista.map(f => (
            <li key={f.id}>
              <button type="button" className="card feedback-item feedback-abre" onClick={() => vm.abrir(f.id)}>
                {f.imagem && <span className="feedback-mini"><img src={f.imagem} alt="" /></span>}
                <span className="feedback-conteudo">
                  <span className="feedback-quem">
                    <b>{f.nome || f.email || '—'}</b>
                    <span className="fraco">{f.quando}</span>
                    <span className={'badge ' + SELO[f.status]}>{NOME[f.status]}</span>
                  </span>
                  <span className="feedback-txt feedback-txt-curto">{f.texto}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {vm.aberto && <JanelaDoFeedback f={vm.aberto} fechar={vm.fecharAberto} ampliar={vm.setAberta} marcar={vm.marcar} />}
      {vm.aberta && (
        <div className="modal-overlay pessoal-fundo feedback-zoom" onMouseDown={() => vm.setAberta('')}>
          <img src={vm.aberta} alt="O print do feedback" />
        </div>
      )}
    </JanelaLateral>
  );
}

/** A solicitação inteira numa janela flutuante por cima da lista: o print (clicar amplia), o texto, quem, quando, a tela
 * e a versão; embaixo Visto / Feito / Reabrir. O Esc fecha só esta janela. */
function JanelaDoFeedback({ f, fechar, ampliar, marcar }: {
  f: NonNullable<ReturnType<typeof useFeedbacks>['aberto']>; fechar: () => void; ampliar: (img: string) => void; marcar: (id: string, s: SituacaoDoFeedback) => void;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fechar(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [fechar]);
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela feedback-janela" role="dialog" aria-modal="true" aria-label={'Feedback de ' + (f.nome || f.email)}>
        <header className="pessoal-topo">
          <h2>{f.nome || f.email || '—'}</h2>
          <span className="fraco">{f.quando}</span>
          <span className={'badge ' + SELO[f.status]}>{NOME[f.status]}</span>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
        </header>
        <div className="feedback-corpo">
          {f.imagem && (
            <button type="button" className="feedback-imagem feedback-amplia" title="Ampliar" onClick={() => ampliar(f.imagem)}>
              <img src={f.imagem} alt="O print do feedback" />
            </button>
          )}
          <p className="feedback-txt">{f.texto}</p>
          <span className="fraco feedback-onde">{f.tela}{f.versao ? ' · ' + f.versao : ''}</span>
        </div>
        <footer className="usuario-pe">
          <span className="tarefas-barra-espaco" />
          {f.status === 'novo' && <button type="button" className="btn btn-outline" onClick={() => marcar(f.id, 'visto')}><Icone nome="olho" />Visto</button>}
          {f.status !== 'feito' && <button type="button" className="btn btn-primary" onClick={() => marcar(f.id, 'feito')}><Icone nome="check" />Feito</button>}
          {f.status === 'feito' && <button type="button" className="btn btn-outline" onClick={() => marcar(f.id, 'novo')}>Reabrir</button>}
        </footer>
      </div>
    </div>
  );
}

/** O item Feedbacks no pé da gaveta ☰ (só o admin), com quantos novos. */
export function ItemDosFeedbacks({ abrir }: { abrir: () => void }) {
  const novos = useFeedbacks().filtros[0].qtd;
  return (
    <button type="button" className="drawer-item" onClick={abrir}>
      <Icone nome="envelope" />Feedbacks{novos > 0 && <span className="menu-contador drawer-contador">{novos}</span>}
    </button>
  );
}
