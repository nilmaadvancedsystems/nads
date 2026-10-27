// A empresa na barra das ferramentas do Fiscal (Rateio de frete, Simples Nacional; 23/10/2026: "melhore a ui… como
// rateio, faturamento e simples"): sem empresa, a busca curta com lupa (código do ERP ou nome) e a lista embaixo (↑ ↓ e
// Enter escolhem); escolhida, o botão com borda com o código e o nome, que troca. A mesma peça nas duas telas (antes cada
// uma tinha a sua, e a do Simples era a busca grande do registro). Só as peças do catálogo (busca curta, lista de achados,
// botão com borda).
import { Icone } from '@nads/ui';

export interface EmpresaAchada { codigo: number | string | null; nome: string; regime?: string }

export interface VmDaEmpresaDaBarra<E extends EmpresaAchada> {
  empresa: { codigo: number | string | null; nome: string } | null;
  busca: string;
  setBusca: (s: string) => void;
  achadas: readonly E[];
  ativo: number;
  setAtivo: (i: number) => void;
  mover: (d: number) => void;
  escolher: (e: E) => void;
  escolherDestacado: () => void;
  trocarEmpresa: () => void;
}

export function EmpresaDaBarra<E extends EmpresaAchada>({ vm, id }: { vm: VmDaEmpresaDaBarra<E>; id: string }) {
  if (vm.empresa) {
    return (
      <button type="button" className="btn btn-outline empresa-da-barra" title="Trocar a empresa" onClick={vm.trocarEmpresa}>
        <Icone nome="briefcase" width={16} height={16} />
        <span className="empresa-da-barra-nome">{vm.empresa.codigo != null && <><b>{vm.empresa.codigo}</b> · </>}{vm.empresa.nome}</span>
        <Icone nome="x" width={14} height={14} />
      </button>
    );
  }
  const aberta = vm.achadas.length > 0;
  return (
    <div className="empresa-da-barra-busca">
      <label className="busca-curta empresa-da-barra">
        <Icone nome="search" width={16} height={16} />
        <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Empresa: código ou nome" aria-label="Buscar a empresa por código ou nome" autoComplete="off"
          role="combobox" aria-expanded={aberta} aria-controls={id}
          onKeyDown={e => {
            if (!aberta) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); vm.escolherDestacado(); }
            else if (e.key === 'Escape') vm.setBusca('');
          }} />
      </label>
      {aberta && (
        <ul className="nf-achados" id={id} role="listbox" aria-label="Empresas encontradas">
          {vm.achadas.map((e, i) => (
            <li key={String(e.codigo) + e.nome}>
              <button type="button" className={'popover-item' + (i === vm.ativo ? ' nf-ativo' : '')} role="option" aria-selected={i === vm.ativo} tabIndex={-1}
                onMouseEnter={() => vm.setAtivo(i)} onClick={() => vm.escolher(e)}>
                <span className="nf-achado-codigo">{e.codigo ?? '—'}</span>
                <span className="popover-texto">{e.nome}</span>
                {e.regime && <span className="popover-dica">{e.regime}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
