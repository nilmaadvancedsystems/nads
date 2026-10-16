// A aba Agenda da Área do Cliente (Vitor, 16/10/2026): o que vence no mês escolhido e se o escritório já fez.
import { Icone, SeletorMes } from '@nads/ui';
import { LinhaDaAgenda } from '../partes/LinhaDaAgenda';
import { useAgenda } from './useAgenda';
import type { DaCasca } from './useAreaCliente';

export function Agenda(props: DaCasca) {
  const vm = useAgenda(props);
  return (
    <section className="card">
      <h3>O que vence no mês</h3>
      <div className="cli-barra">
        <SeletorMes valor={vm.mes} onMudar={vm.mudarMes} rotulo="Mês da agenda" max={vm.ultimo} />
        {vm.itens.length > 0 && <span className="hint">{vm.feitos} feito(s) · {vm.aFazer} por fazer</span>}
      </div>
      {vm.itens.length ? (
        <ul className="cli-lista">{vm.itens.map(i => <LinhaDaAgenda key={i.id} item={i} />)}</ul>
      ) : (
        <div className="gh-blank">
          <Icone nome="calendar" width={32} height={32} />
          <h4>Nada marcado para este mês</h4>
          <p>Escolha outro mês no calendário acima.</p>
        </div>
      )}
    </section>
  );
}
