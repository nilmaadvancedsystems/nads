// Os feedbacks da equipe (Vitor, 07/10/2026: "abra uma janela flutuante", aberta no pé da gaveta ☰, junto da versão):
// à esquerda Novos / Vistos / Feitos / Todos; à direita cada feedback com o print (clicar amplia), o texto, quem,
// quando, a tela e a versão; Visto e Feito.
import { Esqueleto, Icone } from '@nads/ui';
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
            <li key={f.id} className="card feedback-item">
              {f.imagem && (
                <button type="button" className="feedback-mini" onClick={() => vm.setAberta(f.imagem)} title="Ampliar">
                  <img src={f.imagem} alt="" />
                </button>
              )}
              <div className="feedback-conteudo">
                <div className="feedback-quem">
                  <b>{f.nome || f.email || '—'}</b>
                  <span className="fraco">{f.quando}</span>
                  <span className={'badge ' + SELO[f.status]}>{NOME[f.status]}</span>
                </div>
                <p className="feedback-txt">{f.texto}</p>
                <span className="fraco feedback-onde">{f.tela}{f.versao ? ' · ' + f.versao : ''}</span>
              </div>
              <div className="feedback-acoes">
                {f.status === 'novo' && <button type="button" className="btn btn-outline" onClick={() => vm.marcar(f.id, 'visto')}><Icone nome="olho" />Visto</button>}
                {f.status !== 'feito' && <button type="button" className="btn btn-primary" onClick={() => vm.marcar(f.id, 'feito')}><Icone nome="check" />Feito</button>}
                {f.status === 'feito' && <button type="button" className="btn btn-ghost" onClick={() => vm.marcar(f.id, 'novo')}>Reabrir</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {vm.aberta && (
        <div className="modal-overlay pessoal-fundo feedback-zoom" onMouseDown={() => vm.setAberta('')}>
          <img src={vm.aberta} alt="O print do feedback" />
        </div>
      )}
    </JanelaLateral>
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
