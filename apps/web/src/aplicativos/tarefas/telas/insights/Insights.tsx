// Insights de "Minhas empresas": os números da competência por situação. Cada número abre a lista
// de empresas filtrada por aquela situação.
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { useInsights } from './useInsights';

const COR: Record<string, string> = { parada: 'cor-entrada', concluida: 'cor-saida' };

export function Insights() {
  const vm = useInsights();
  if (!vm.temRotina) return <EmDesenvolvimento nome={'A rotina do ' + (vm.departamento === 'fiscal' ? 'Fiscal' : 'Departamento Pessoal')} />;
  return (
    <section>
      <div className="tarefas-filtros">
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="hint">Competência</span>
          <select className="select-compact" value={vm.competencia} onChange={e => vm.setCompetencia(e.target.value)}>
            {vm.competencias.map(c => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
          </select>
        </label>
      </div>
      {vm.carregando ? <p className="empty">Carregando…</p> : (
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
