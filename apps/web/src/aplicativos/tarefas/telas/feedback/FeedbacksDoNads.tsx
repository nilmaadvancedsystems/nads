// Cadastro › Feedbacks: cada feedback com o print (clicar amplia), o texto, quem, quando, a tela e a versão; Visto e Feito.
import { Esqueleto, Icone, useCarregando } from '@nads/ui';
import { useFeedbacks } from './useFeedbacks';

const SELO = { novo: 'badge-warn', visto: 'badge-neutral', feito: 'badge-ok' } as const;
const NOME = { novo: 'Novo', visto: 'Visto', feito: 'Feito' } as const;

export function FeedbacksDoNads() {
  const vm = useFeedbacks();
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-barra-topo">
        <div className="chip-row">
          {vm.filtros.map(f => (
            <button key={f.rotulo} type="button" className={'chip-f' + (vm.filtro === f.valor ? ' on' : '')} onClick={() => vm.setFiltro(f.valor)}>
              {f.rotulo} <span className="gh-counter">{f.qtd}</span>
            </button>
          ))}
        </div>
      </div>
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
    </section>
  );
}
