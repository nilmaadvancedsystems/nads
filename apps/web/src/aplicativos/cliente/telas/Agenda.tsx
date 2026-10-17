// A agenda do mês da Área do Cliente (Vitor, 16/10/2026; dentro de Guias e obrigações): o que vence no mês escolhido e se
// o escritório já fez.
import { SeletorMes } from '@nads/ui';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { useAgenda } from './useAgenda';
import type { DaCasca } from './useAreaCliente';

export function Agenda(props: Pick<DaCasca, 'area' | 'hoje'>) {
  const vm = useAgenda(props);
  return (
    <section className="card">
      <div className="card-head">
        <h3>Agenda do mês</h3>
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês da agenda" max={vm.ultimo} />
      </div>
      {vm.itens.length > 0 && <p className="hint" style={{ margin: '0 0 8px' }}>{vm.feitos} feito(s) · {vm.aFazer} por fazer</p>}
      {vm.itens.length
        ? <ul>{vm.itens.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
        : <p className="empty">Nada marcado para este mês.</p>}
    </section>
  );
}
