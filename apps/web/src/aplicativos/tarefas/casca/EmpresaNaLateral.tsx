// View da escolha da empresa no alto do menu ☰, entre o N e o × (27/10/2026: "faça no estilo do nads"): a busca curta com
// lupa e a lista embaixo, a mesma peça das ferramentas do Fiscal (↑ ↓ e Enter escolhem; Esc limpa). Escolhida a empresa,
// a lista mostra o código e o nome e o "Abrir no …" do setor da pessoa (o admin, os dois; o DP não
// vê a busca). Só as peças
// do catálogo (busca curta, lista de achados, itens do menu).
import { Icone } from '@nads/ui';
import { useEmpresaNaLateral } from './useEmpresaNaLateral';

export function EmpresaNaLateral({ aoAbrir }: { aoAbrir?: () => void }) {
  const vm = useEmpresaNaLateral(aoAbrir);
  const comLista = vm.achadas.length > 0;
  if (!vm.setores.length) return null;
  return (
    <div className="empresa-no-menu">
      <label className="busca-curta">
        <Icone nome="search" width={16} height={16} />
        <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Abrir empresa" aria-label="Abrir uma empresa: buscar por código ou nome"
          autoComplete="off" role="combobox" aria-expanded={comLista || !!vm.escolhida} aria-controls="empresa-no-menu"
          onKeyDown={e => {
            if (e.key === 'Escape' && (vm.busca || vm.escolhida)) { e.preventDefault(); e.stopPropagation(); vm.limpar(); return; }
            if (!comLista) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); vm.escolherDestacado(); }
          }} />
      </label>
      {comLista && (
        <ul className="popover empresa-no-menu-lista" id="empresa-no-menu" role="listbox" aria-label="Empresas encontradas">
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
      {vm.escolhida && (
        <div className="popover empresa-no-menu-lista" id="empresa-no-menu" role="menu" aria-label={'Abrir ' + vm.escolhida.nome}>
          <p className="popover-label">{vm.escolhida.codigo != null && vm.escolhida.codigo + ' · '}{vm.escolhida.nome}</p>
          {vm.setores.map((s, i) => (
            <button key={s.valor} type="button" className="popover-item" role="menuitem" autoFocus={i === 0} onClick={() => vm.abrir(s.valor)}>
              <Icone nome={s.valor === 'fiscal' ? 'recibo' : 'scale'} width={16} height={16} />
              <span className="popover-texto">Abrir no {s.rotulo}</span>
            </button>
          ))}
          <hr className="popover-sep" />
          <button type="button" className="popover-item" role="menuitem" onClick={vm.limpar}>
            <Icone nome="x" width={16} height={16} /><span className="popover-texto">Escolher outra</span>
          </button>
        </div>
      )}
    </div>
  );
}
