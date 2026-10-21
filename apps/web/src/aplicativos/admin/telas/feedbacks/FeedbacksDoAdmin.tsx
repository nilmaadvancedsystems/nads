// Admin › Feedbacks: os mesmos Feedbacks da janela ☰ da Tarefas (o mesmo ViewModel useFeedbacks e o mesmo miolo
// ListaDosFeedbacks), numa página: a situação (Novos, Vistos, Feitos, Todos, Bugs) nos chips, com quantos de cada; embaixo,
// a prioridade, a ordem e a lista. Clicar abre o feedback inteiro (Visto, Feito, Reabrir).
import { Icone, useCarregando } from '@nads/ui';
import { ICONE_DO_FILTRO, ListaDosFeedbacks } from '../../../tarefas/telas/feedback/FeedbacksDoNads';
import { useFeedbacks } from '../../../tarefas/telas/feedback/useFeedbacks';

export function FeedbacksDoAdmin() {
  const vm = useFeedbacks();
  useCarregando(vm.carregando);
  return (
    <section className="admin-feedbacks">
      <div className="chip-row admin-feedbacks-filtro">
        {vm.filtros.map(f => (
          <button key={f.valor || 'todos'} type="button" className={'chip-f' + (vm.filtro === f.valor ? ' on' : '')} aria-pressed={vm.filtro === f.valor} onClick={() => vm.setFiltro(f.valor)}>
            <Icone nome={ICONE_DO_FILTRO[f.valor]} width={14} height={14} />{f.rotulo}<span className="gh-counter">{f.qtd}</span>
          </button>
        ))}
      </div>
      <ListaDosFeedbacks vm={vm} />
    </section>
  );
}
