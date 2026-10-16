// Insights de "Minhas empresas": os números da competência por situação. Cada número abre a lista
// de empresas filtrada por aquela situação.
import { Esqueleto, MenuSuspenso, useCarregando } from '@nads/ui';
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { useInsights } from './useInsights';

const COR: Record<string, string> = { parada: 'cor-entrada', concluida: 'cor-saida' };

export function Insights() {
  const vm = useInsights();
  useCarregando(vm.carregando);
  if (!vm.temRotina) return <EmDesenvolvimento nome={'A rotina do ' + (vm.departamento === 'fiscal' ? 'Fiscal' : 'Departamento Pessoal')} />;
  return (
    <section>
      <div className="tarefas-filtros">
        {/* a competência no mesmo menu com o calendário da Minhas empresas (revisão da UI, 16/10/2026: eram três peças diferentes) */}
        <MenuSuspenso icone="calendar" rotulo={vm.competencias.find(c => c.valor === vm.competencia)?.rotulo ?? vm.competencia} titulo="Competência" dica="Trocar a competência"
          itens={vm.competencias.map(c => ({ rotulo: c.rotulo, marcado: c.valor === vm.competencia, onClick: () => vm.setCompetencia(c.valor) }))} />
      </div>
      {vm.carregando ? <Esqueleto numeros={4} linhas={4} /> : (
        <>
          <div className="stat-grid">
            {vm.numeros.map(n => (
              <button key={n.valor} type="button" className="stat stat-clicavel" title={'Ver as empresas: ' + n.rotulo.toLowerCase()} onClick={() => vm.abrirLista(n.valor)}>
                <p className="stat-label">{n.rotulo}</p>
                <p className={'stat-value' + (COR[n.valor] ? ' ' + COR[n.valor] : '')}>{n.qtd}</p>
              </button>
            ))}
          </div>
          <p className="hint">{vm.total} empresas na competência.</p>
        </>
      )}
    </section>
  );
}
