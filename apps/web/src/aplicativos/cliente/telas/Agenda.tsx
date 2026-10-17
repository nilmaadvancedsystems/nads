// Os vencimentos do mês na Área do Cliente (Vitor, 16/10/2026; dentro de Guias e obrigações): a data, a obrigação e a
// situação, com o seletor de mês do nads.
import { SeletorMes } from '@nads/ui';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { useAgenda } from './useAgenda';
import type { DaCasca } from './useAreaCliente';

export function Agenda(props: Pick<DaCasca, 'area' | 'hoje'>) {
  const vm = useAgenda(props);
  return (
    <section>
      <div className="cli-secao cli-secao-com-acao">
        <h2>Vencimentos</h2>
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês dos vencimentos" max={vm.ultimo} />
      </div>
      {vm.itens.length
        ? <ul>{vm.itens.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
        : <p className="cli-vazio">Nada marcado para este mês.</p>}
    </section>
  );
}
