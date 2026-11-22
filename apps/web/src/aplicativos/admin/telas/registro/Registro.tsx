// Configurações › Admin › Registro de alterações (22/11/2026, ficha E20; o dono: "pode fazer tudo"): quem mudou o quê nos
// usuários e nos acessos (e, desligando o filtro, tudo o que a auditoria guarda: os robôs e o Entregas). Ninguém edita nem apaga.
import { Alerta, Esqueleto, Icone, useCarregando } from '@nads/ui';
import { useRegistro } from './useRegistro';

export function Registro() {
  const vm = useRegistro();
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-barra-topo" style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={vm.soSensiveis} onChange={e => vm.setSoSensiveis(e.target.checked)} /> Só usuários e acessos
        </label>
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar pessoa ou texto" aria-label="Buscar no registro" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-sm btn-outline" onClick={vm.recarregar}><Icone nome="girar" width={14} height={14} />Atualizar</button>
      </div>
      {vm.erro && <div className="alerta-linha"><Alerta titulo="O registro não abriu" texto={vm.erro} /></div>}
      {vm.carregando ? <Esqueleto linhas={8} /> : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.id}>
                  <td className="fraco" style={{ whiteSpace: 'nowrap' }}>{l.data} {l.hora}</td>
                  <td>{l.por}</td>
                  <td><span className={'badge ' + (l.sensivel ? 'badge-warning' : 'badge-neutral')}>{l.rotulo}</span></td>
                  <td className="wrap">{l.detalhe || '—'}</td>
                </tr>
              ))}
              {!vm.linhas.length && <tr><td colSpan={4} className="hint">Nada no registro{vm.total ? ' com este filtro' : ' ainda'}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
