// Minhas empresas: escolher a competência e iniciar (ou continuar) as etapas de cada empresa.
import { Stat } from '@nads/ui';
import { EmDesenvolvimento } from '../em-desenvolvimento/EmDesenvolvimento';
import { LIMITE, useMinhasEmpresas } from './useMinhasEmpresas';

const SELO: Record<string, string> = { parada: 'badge-bad', 'em-andamento': 'badge-warn', 'nao-iniciada': 'badge-neutral', concluida: 'badge-ok' };

export function MinhasEmpresas() {
  const vm = useMinhasEmpresas();
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
        <input type="text" placeholder="Buscar empresa (nome ou código)" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
      </div>

      <div className="stat-grid">
        <Stat rotulo="Paradas" valor={vm.numeros.paradas} cor="entrada" />
        <Stat rotulo="Em andamento" valor={vm.numeros.andamento} />
        <Stat rotulo="Não iniciadas" valor={vm.numeros.naoIniciadas} />
        <Stat rotulo="Concluídas" valor={vm.numeros.concluidas} cor="saida" />
      </div>

      {vm.carregando ? <p className="empty">Carregando…</p> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Código</th><th>Empresa</th><th>Etapas</th><th>Situação</th><th>Próxima etapa</th><th /></tr></thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.chave}>
                  <td className="num">{l.codigo ?? '—'}</td>
                  <td>{l.nome}</td>
                  <td>
                    <span className="tarefas-barra" aria-label={l.concluidas + ' de ' + l.total}><span style={{ width: (100 * l.concluidas / l.total) + '%' }} /></span>
                    <span className="hint"> {l.concluidas}/{l.total}</span>
                  </td>
                  <td><span className={'badge ' + SELO[l.situacao]}>{l.rotuloSituacao}</span></td>
                  <td>{l.proxima}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" className={'btn btn-sm ' + (l.situacao === 'concluida' ? 'btn-outline' : 'btn-primary')} onClick={() => vm.abrir(l.rota)}>{l.acao}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {vm.total > LIMITE && <p className="hint" style={{ padding: '8px 16px' }}>Mostrando {LIMITE} de {vm.total}. Use a busca.</p>}
        </div>
      )}
    </section>
  );
}
