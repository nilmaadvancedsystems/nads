// View do topo da barra lateral de Minhas empresas (27/10/2026): o botão "Escolher empresa ▾" (com a empresa aberta, o
// código e o nome dela), que abre a busca, o setor e o Abrir; e os Avisos do escritório, que levam ao Início. Só as peças
// do catálogo (menu suspenso, busca curta, lista de achados, segmentado, botões).
import { Icone, MenuSuspenso, Segmentado } from '@nads/ui';
import { useEmpresaNaLateral } from './useEmpresaNaLateral';

type Vm = ReturnType<typeof useEmpresaNaLateral>;

function PainelDeEscolher({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const aberta = vm.achadas.length > 0;
  return (
    <div className="escolher-empresa-painel">
      {vm.escolhida ? (
        <>
          <div className="escolher-empresa-escolhida">
            <Icone nome="briefcase" width={16} height={16} />
            <span title={vm.escolhida.nome}>{vm.escolhida.codigo != null && <b>{vm.escolhida.codigo} · </b>}{vm.escolhida.nome}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={vm.trocar}>Trocar</button>
          </div>
          {vm.setores.length > 0 && <Segmentado valor={vm.setor} onMudar={vm.setSetor} opcoes={vm.setores} />}
          <div className="escolher-empresa-pe">
            <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
            <button type="button" className="btn btn-primary" onClick={() => vm.abrir(fechar)} autoFocus>
              <Icone nome="play" width={16} height={16} />Abrir
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="busca-curta">
            <Icone nome="search" width={16} height={16} />
            <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Código ou nome da empresa" aria-label="Buscar a empresa por código ou nome"
              autoComplete="off" autoFocus role="combobox" aria-expanded={aberta} aria-controls="empresa-na-lateral"
              onKeyDown={e => {
                if (!aberta) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); vm.mover(1); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); vm.mover(-1); }
                else if (e.key === 'Enter') { e.preventDefault(); vm.escolherDestacado(); }
              }} />
          </label>
          {aberta ? (
            <ul className="nf-achados" id="empresa-na-lateral" role="listbox" aria-label="Empresas encontradas">
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
          ) : <p className="hint">{vm.busca.trim() ? 'Nenhuma empresa com esse código ou nome.' : 'Digite o código do ERP ou parte do nome.'}</p>}
        </>
      )}
    </div>
  );
}

export function EmpresaNaLateral({ aberta }: { aberta: { codigo: number | null; nome: string } | null }) {
  const vm = useEmpresaNaLateral(aberta);
  return (
    <>
      {vm.podeEscolher && (
        <MenuSuspenso icone="briefcase" rotulo={<span className="escolher-empresa-nome">{vm.rotulo}</span>} className="btn btn-outline escolher-empresa"
          titulo="Abrir uma empresa" dica={vm.aberta ? 'Trocar a empresa' : 'Escolher a empresa e o setor'} largura={340}
          conteudo={fechar => <PainelDeEscolher vm={vm} fechar={fechar} />} />
      )}
      <button type="button" className="subnav-item" onClick={vm.verAvisos} title="Os avisos do escritório">
        <Icone nome="alert" width={16} height={16} /><span>Avisos</span>
        {vm.avisos > 0 && <span className="subnav-contador">{vm.avisos}</span>}
      </button>
    </>
  );
}
