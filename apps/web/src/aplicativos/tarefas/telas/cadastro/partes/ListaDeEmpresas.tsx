// A busca de empresa do Cadastro (nome ou código do ERP) com a lista embaixo; sem busca, as abertas por último.
// Serve à página sem empresa e ao "empresa ▾" da barra de cima.
import { Icone } from '@nads/ui';
import type { useEscolherNoCadastro } from './useEscolherNoCadastro';

export function ListaDeEmpresas({ vm, focar, aoEntrar }: { vm: ReturnType<typeof useEscolherNoCadastro>; focar?: boolean; aoEntrar?: () => void }) {
  const buscando = !!vm.busca.trim();
  const itens = buscando ? vm.achadas : vm.recentes;
  return (
    <div className="cad-escolher">
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" autoFocus={focar} placeholder="Nome ou código do ERP" aria-label="Buscar empresa (nome ou código)" value={vm.busca}
          onChange={e => vm.onBusca(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); vm.onConfirmar(); aoEntrar?.(); } }} />
      </label>
      {!buscando && <p className="cad-escolher-titulo">{vm.recentes.length ? 'Abertas por último' : 'Digite o nome ou o código da empresa.'}</p>}
      {buscando && !vm.total && <p className="empty">Nenhuma empresa com esse nome.</p>}
      {!!itens.length && (
        <div className="emp-list">
          {itens.map(x => (
            <button key={(x.codigo ?? '') + x.nome} type="button" className="emp-item" title={'Abrir ' + x.nome} onClick={() => { vm.onEntrar(x); aoEntrar?.(); }}>
              <span className="emp-cod">{x.codigo != null ? String(x.codigo) : '—'}</span>
              <span className="emp-txt"><span className="emp-nome">{x.nome}</span>{x.regime && <span className="emp-reg">{x.regime}</span>}</span>
            </button>
          ))}
        </div>
      )}
      {buscando && vm.total > vm.limite && <p className="hint" style={{ padding: '4px 14px 10px' }}>Mostrando {vm.limite} de {vm.total}. Refine a busca.</p>}
    </div>
  );
}
