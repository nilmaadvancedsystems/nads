// View da escolha da empresa no alto do menu ☰, entre o N e o × (27/10/2026: "faça no estilo do nads"): as peças da
// empresa das ferramentas do Fiscal. Com a empresa escolhida, o botão com borda com o código e o nome (fica o tempo todo;
// o clique mostra o "Abrir no …" de cada setor da pessoa) e a lupa ao lado, que troca; sem ela, a busca curta e a lista
// embaixo (↑ ↓ e Enter escolhem; Esc desiste). O campo não ganha o foco sozinho ao abrir o menu (só fica vermelho com o
// clique). O DP não vê a escolha.
import { Icone } from '@nads/ui';
import { useEmpresaNaLateral } from './useEmpresaNaLateral';

export function EmpresaNaLateral({ aberta, aoAbrir }: { aberta: { codigo: number | null; nome: string; rota: string } | null; aoAbrir?: () => void }) {
  const vm = useEmpresaNaLateral(aberta, aoAbrir);
  const comLista = vm.buscando && vm.achadas.length > 0;
  if (!vm.setores.length) return null;
  return (
    <div className="empresa-no-menu" data-sem-foco-inicial>
      {!vm.buscando && vm.atual ? (
        <span className="empresa-no-menu-atual">
          <button type="button" className="btn btn-outline empresa-da-barra" title={'Abrir ' + vm.atual.nome} aria-expanded={vm.mostrarSetores} onClick={vm.alternarSetores}>
            <Icone nome="briefcase" width={16} height={16} />
            <span className="empresa-da-barra-nome">{vm.atual.codigo != null && <><b>{vm.atual.codigo}</b> · </>}{vm.atual.nome}</span>
            <Icone nome="caretDown" width={12} height={12} />
          </button>
          <button type="button" className="icon-btn" title="Trocar a empresa" aria-label="Trocar a empresa" onClick={vm.trocar}><Icone nome="search" width={16} height={16} /></button>
        </span>
      ) : (
        <label className="busca-curta">
          <Icone nome="search" width={16} height={16} />
          <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Abrir empresa" aria-label="Abrir uma empresa: buscar por código ou nome"
            autoFocus={!!vm.atual} autoComplete="off" role="combobox" aria-expanded={comLista} aria-controls="empresa-no-menu"
            onKeyDown={e => {
              if (e.key === 'Escape' && (vm.busca || vm.atual)) { e.preventDefault(); e.stopPropagation(); vm.desistir(); return; }
              if (!comLista) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
              else if (e.key === 'Enter') { e.preventDefault(); vm.escolherDestacado(); }
            }} />
        </label>
      )}
      {comLista && (
        <ul className="popover empresa-no-menu-lista" id="empresa-no-menu" role="listbox" aria-label="Suas empresas">
          {vm.achadas.map((e, i) => (
            <li key={String(e.codigo) + e.nome}>
              <button type="button" className={'popover-item' + (i === vm.ativo ? ' nf-ativo' : '')} role="option" aria-selected={i === vm.ativo} tabIndex={-1}
                onMouseEnter={() => vm.setAtivo(i)} onClick={() => vm.escolher(e)}>
                <span className="nf-achado-codigo">{e.codigo ?? '—'}</span>
                <span className="popover-texto">{e.nome}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {vm.buscando && vm.busca.trim() && !comLista && (
        <div className="popover empresa-no-menu-lista"><p className="popover-label">Nenhuma das suas empresas com esse código ou nome.</p></div>
      )}
      {!vm.buscando && vm.atual && vm.mostrarSetores && (
        <div className="popover empresa-no-menu-lista" role="menu" aria-label={'Abrir ' + vm.atual.nome}>
          {vm.setores.map((s, i) => (
            <button key={s.valor} type="button" className="popover-item" role="menuitem" autoFocus={i === 0} onClick={() => vm.abrir(s.valor)}>
              <Icone nome={s.valor === 'fiscal' ? 'recibo' : 'scale'} width={16} height={16} />
              <span className="popover-texto">Abrir no {s.rotulo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
