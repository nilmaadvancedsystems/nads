// Cadastro › Usuários: a equipe do Entregas. Cada pessoa: cargo (departamento e nível), papéis, ativo e os
// computadores liberados (abrindo a linha). Só o admin muda; os outros veem.
import type { usuarios } from '@nads/core';
import { Icone, Interruptor, useCarregando } from '@nads/ui';
import { useUsuariosDoNads } from './useUsuariosDoNads';

export function UsuariosDoNads() {
  const vm = useUsuariosDoNads();
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-barra-topo">
        <span className="tarefas-contador"><Icone nome="briefcase" /><b>{vm.linhas.length}</b> pessoas</span>
        {!vm.admin && <span className="fraco usuarios-aviso">Só um administrador muda a equipe.</span>}
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar pessoa" aria-label="Buscar pessoa" value={vm.busca} onChange={ev => vm.setBusca(ev.target.value)} />
        </label>
      </div>
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: a equipe é a de exemplo e nada vai para o banco.</p>}
      <div className="table-wrap">
        <table className="tabela-empresas usuarios-tabela">
          <thead><tr><th>Pessoa</th><th>Departamento</th><th>Nível</th><th>Papéis</th><th>Ativo</th><th>Computadores</th></tr></thead>
          <tbody>
            {!vm.carregando && vm.linhas.map(p => (
              <UsuarioLinha key={p.uid} vm={vm} p={p} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type Vm = ReturnType<typeof useUsuariosDoNads>;
type Linha = Vm['linhas'][number];

function UsuarioLinha({ vm, p }: { vm: Vm; p: Linha }) {
  const aberto = vm.aberto === p.uid;
  return (
    <>
      <tr className={p.ativo ? undefined : 'cad-encerrada'}>
        <td><span className="cad-conta"><b>{p.nome}</b><span className="fraco">{p.email}</span></span></td>
        <td>
          <select value={p.departamento || ''} disabled={!vm.admin} aria-label={'Departamento de ' + p.nome}
            onChange={ev => void vm.mudarCargo(p, (ev.target.value || null) as usuarios.Departamento | null, p.nivel)}>
            <option value="">—</option>
            {vm.departamentos.map(d => <option key={d.id} value={d.id}>{d.rotulo}</option>)}
          </select>
        </td>
        <td>
          <select value={p.nivel || ''} disabled={!vm.admin} aria-label={'Nível de ' + p.nome}
            onChange={ev => void vm.mudarCargo(p, p.departamento, (ev.target.value || null) as usuarios.Nivel | null)}>
            <option value="">—</option>
            {vm.niveis.map(n => <option key={n.id} value={n.id}>{n.rotulo}</option>)}
          </select>
        </td>
        <td>
          <span className="usuarios-papeis">
            {vm.papeis.map(x => (
              <button key={x.id} type="button" className={'chip-f' + (p.papeis.includes(x.id) ? ' on' : '')} disabled={!vm.admin}
                aria-pressed={p.papeis.includes(x.id)} onClick={() => void vm.alternarPapel(p, x.id)}>{x.rotulo}</button>
            ))}
          </span>
        </td>
        <td><Interruptor ligado={p.ativo} onMudar={() => void vm.ativar(p)} rotulo={(p.ativo ? 'Desativar ' : 'Ativar ') + p.nome} /></td>
        <td>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.alternarAberto(p.uid)} aria-expanded={aberto}>
            <Icone nome="monitor" />{p.computadores.length}
          </button>
        </td>
      </tr>
      {aberto && (
        <tr className="usuarios-computadores">
          <td colSpan={6}>
            {!p.computadores.length ? <p className="fraco">Nenhum computador liberado (a proteção do login só pede liberação quando está ligada).</p> : (
              <ul>
                {p.computadores.map(s => (
                  <li key={s.id}>
                    <Icone nome="monitor" /><span>{s.computador}</span><span className="fraco">liberado em {vm.quando(s.liberadoEm)}</span>
                    {vm.admin && <button type="button" className="btn btn-outline btn-sm" onClick={() => void vm.revogar(s)}>Revogar</button>}
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
