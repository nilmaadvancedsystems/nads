// View do topo da barra lateral (27/10/2026): o seletor da empresa, no jeito do seletor de equipe do Vercel/Notion (o
// ícone, em cima o código e o setor, embaixo o nome em até duas linhas, e o ▾), que abre a busca, o setor e o Abrir. Os
// avisos ficam só no Início ("pra que eu quero aviso aqui?"). Só as peças do catálogo (menu suspenso, busca curta, lista
// de achados, segmentado, botões).
import { Icone, MenuSuspenso, Segmentado } from '@nads/ui';
import { useEmpresaNaLateral } from './useEmpresaNaLateral';

type Vm = ReturnType<typeof useEmpresaNaLateral>;

function PainelDeEscolher({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const aberta = vm.achadas.length > 0;
  return (
    <div className="escolher-empresa-painel">
      <p className="hint">1. A empresa</p>
      {vm.escolhida ? (
        <div className="escolher-empresa-escolhida">
          <Icone nome="briefcase" width={16} height={16} />
          <span title={vm.escolhida.nome}>{vm.escolhida.codigo != null && <b>{vm.escolhida.codigo} · </b>}{vm.escolhida.nome}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={vm.trocar}>Trocar</button>
        </div>
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
          {aberta && (
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
          )}
          {!aberta && vm.busca.trim() && <p className="hint">Nenhuma empresa com esse código ou nome.</p>}
        </>
      )}
      <p className="hint">2. O setor</p>
      <Segmentado valor={vm.setor} onMudar={vm.setSetor} opcoes={[...vm.setores]} />
      <div className="escolher-empresa-pe">
        <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
        <button type="button" className="btn btn-primary" disabled={!vm.escolhida} onClick={() => vm.abrir(fechar)} autoFocus={!!vm.escolhida}
          title={vm.escolhida ? undefined : 'Escolha a empresa primeiro'}>
          <Icone nome="play" width={16} height={16} />Abrir
        </button>
      </div>
    </div>
  );
}

export function EmpresaNaLateral({ aberta }: { aberta: { codigo: number | null; nome: string } | null }) {
  const vm = useEmpresaNaLateral(aberta);
  return (
    <MenuSuspenso semSeta className={'seletor-empresa' + (vm.aberta ? ' com-empresa' : '')} titulo="Abrir uma empresa"
      dica={vm.aberta ? 'Trocar a empresa' : 'Escolher a empresa e o setor'} largura={340}
      rotulo={
        <>
          <span className="seletor-empresa-icone" aria-hidden="true"><Icone nome={vm.aberta ? 'predio' : 'search'} width={16} height={16} /></span>
          <span className="seletor-empresa-texto">
            <span className="seletor-empresa-rotulo">{vm.detalhe}</span>
            <span className="seletor-empresa-nome">{vm.rotulo}</span>
          </span>
          <Icone nome="caretDown" width={12} height={12} />
        </>
      }
      conteudo={fechar => <PainelDeEscolher vm={vm} fechar={fechar} />} />
  );
}
