// Cadastro › Usuários: a equipe do Entregas numa lista limpa — a foto (ou as iniciais), o nome e o e-mail, o cargo, os
// papéis que a pessoa tem, se está ativa e os computadores liberados. Clicar abre a janela da pessoa; "Novo usuário"
// abre a de criar o acesso (as duas flutuantes, no desenho da Minha página).
import { Esqueleto, Icone, useCarregando } from '@nads/ui';
import { JanelaDoUsuario, JanelaNovoUsuario } from './JanelaDoUsuario';
import { useUsuariosDoNads, type FiltroDeUsuarios } from './useUsuariosDoNads';

const FILTROS: { id: FiltroDeUsuarios; rotulo: string }[] = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativos', rotulo: 'Ativos' },
  { id: 'inativos', rotulo: 'Inativos' },
];

export function UsuariosDoNads() {
  const vm = useUsuariosDoNads();
  useCarregando(vm.carregando);
  return (
    <section className="usuarios">
      <div className="tarefas-barra-topo">
        <div className="chip-row usuarios-filtros">
          {FILTROS.map(f => (
            <button key={f.id} type="button" className={'chip-f' + (vm.filtro === f.id ? ' on' : '')} onClick={() => vm.setFiltro(f.id)}>
              {f.rotulo} <span className="gh-counter">{vm.contagem[f.id]}</span>
            </button>
          ))}
        </div>
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar pessoa" aria-label="Buscar pessoa" value={vm.busca} onChange={ev => vm.setBusca(ev.target.value)} />
        </label>
        {vm.admin && <button type="button" className="btn btn-primary" onClick={vm.abrirNovo}><Icone nome="plus" />Novo usuário</button>}
      </div>
      {!vm.admin && <p className="hint">Só um administrador muda a equipe; aqui você vê quem é quem.</p>}
      {vm.exemplos && <p className="hint drive-aviso">Dados de exemplo: a equipe é a de exemplo e nada vai para o banco.</p>}
      {vm.carregando ? <Esqueleto linhas={6} /> : !vm.linhas.length ? (
        <div className="card gh-blank"><Icone nome="usuario" /><h4>Ninguém aqui</h4><p>{vm.busca ? 'Nenhuma pessoa com "' + vm.busca + '".' : 'Nenhuma pessoa neste filtro.'}</p></div>
      ) : (
        <ul className="card usuarios-lista">
          {vm.linhas.map(p => (
            <li key={p.uid}>
              <button type="button" className={'usuarios-item' + (p.ativo ? '' : ' inativo')} onClick={() => vm.abrirPessoa(p.uid)} aria-label={'Abrir ' + p.nome}>
                {p.fotoPerfil ? <img className="usuarios-foto" src={p.fotoPerfil} alt="" /> : <span className="usuarios-foto usuarios-iniciais" aria-hidden="true">{p.iniciais}</span>}
                <span className="usuarios-quem"><b>{p.nome}</b><span className="fraco">{p.email}</span></span>
                <span className={'usuarios-cargo' + (p.cargo ? '' : ' fraco')}>{p.cargo || 'Sem cargo'}</span>
                <span className="usuarios-papeis">{p.rotulosDosPapeis.map(r => <span key={r} className="badge badge-neutral">{r}</span>)}</span>
                <span className="usuarios-estado">
                  <span className={'usuarios-ponto' + (p.ativo ? ' ok' : '')} aria-hidden="true" />{p.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <span className="usuarios-pcs fraco" title="Computadores liberados"><Icone nome="monitor" />{p.computadores.length}</span>
                <Icone nome="chevronRight" className="usuarios-seta" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {vm.pessoa && <JanelaDoUsuario vm={vm} />}
      {vm.novoAberto && <JanelaNovoUsuario fechar={vm.fechar} />}
    </section>
  );
}
