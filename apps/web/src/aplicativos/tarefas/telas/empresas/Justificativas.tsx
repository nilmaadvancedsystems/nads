// Minhas empresas › Justificativas (Vitor, 28/10/2026: "coloque um menu superior (Empresas/Justificativas/Configurações)"):
// as etapas paradas na competência, com o motivo, que ficavam embaixo da lista. A competência no mesmo menu da lista.
import { MenuSuspenso } from '@nads/ui';
import { useDepartamentoDaTela } from '../../casca/departamento';
import { useVisaoContabil } from '../contabil/useVisaoContabil';
import { EtapasParadas } from './partes/EtapasParadas';

export function Justificativas() {
  const { dep } = useDepartamentoDaTela();
  const vm = useVisaoContabil(dep);
  return (
    <section>
      <div className="tarefas-barra-topo">
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo || vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
      </div>
      <EtapasParadas dep={dep} />
    </section>
  );
}
