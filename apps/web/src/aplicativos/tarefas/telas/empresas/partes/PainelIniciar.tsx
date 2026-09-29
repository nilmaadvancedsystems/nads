// O painel do botão "Iniciar", no jeito do "Code ▾" do GitHub: abas em cima (Empresas / Recentes),
// o filtro rápido e a busca, a lista (só código e nome) e, embaixo, os atalhos. Minhas recentes: as
// acessadas nos últimos 3 dias.
import { Icone, Segmentado } from '@nads/ui';
import type { useMinhasEmpresas } from '../useMinhasEmpresas';

type Vm = ReturnType<typeof useMinhasEmpresas>;
type Linha = Vm['paraIniciar'][number];

function Lista({ linhas, onEscolher }: { linhas: Linha[]; onEscolher: (l: Linha) => void }) {
  return (
    <div className="iniciar-lista">
      {linhas.map(l => (
        <button key={l.chave} type="button" className="popover-item iniciar-item" role="menuitem" onClick={() => onEscolher(l)}>
          <span className="num hint">{l.codigo ?? '—'}</span>
          <span className="iniciar-nome">{l.nome}</span>
        </button>
      ))}
    </div>
  );
}

export function PainelIniciar({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const ir = (l: Linha | null) => { if (!l) return; fechar(); vm.iniciar(l.rota); };
  return (
    <div className="iniciar-pop">
      <div className="iniciar-abas" role="tablist">
        <button type="button" role="tab" className="iniciar-aba" aria-selected={vm.abaIniciar === 'escolher'} onClick={() => vm.setAbaIniciar('escolher')}>Empresas</button>
        <button type="button" role="tab" className="iniciar-aba" aria-selected={vm.abaIniciar === 'recentes'} onClick={() => vm.setAbaIniciar('recentes')}>Recentes</button>
      </div>

      {vm.abaIniciar === 'escolher' ? (
        <>
          <Segmentado valor={vm.filtroIniciar} opcoes={vm.filtrosIniciar.map(f => ({ ...f }))} onMudar={vm.setFiltroIniciar} />
          <label className="busca-curta larga">
            <Icone nome="search" />
            <input type="text" autoFocus placeholder="Nome ou código" aria-label="Buscar empresa (nome ou código)" value={vm.buscaIniciar}
              onChange={e => vm.setBuscaIniciar(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') ir(vm.paraIniciar[0] || null); }} />
          </label>
          {vm.paraIniciar.length === 0
            ? <p className="hint iniciar-nada">Nenhuma empresa aqui.</p>
            : <Lista linhas={vm.paraIniciar} onEscolher={ir} />}
          {vm.totalParaIniciar > vm.paraIniciar.length && (
            <p className="hint iniciar-nada">Mostrando {vm.paraIniciar.length} de {vm.totalParaIniciar}. Digite para achar as outras.</p>
          )}
        </>
      ) : (
        <>
          {vm.recentes.length ? <Lista linhas={vm.recentes} onEscolher={ir} /> : (
            <div className="iniciar-vazio">
              <b>Nenhuma empresa ainda</b>
              <p className="hint">Você não mexeu em nenhuma empresa nos últimos 3 dias.</p>
              <button type="button" className="btn btn-primary btn-sm" disabled={!vm.proximaDaFila} onClick={() => ir(vm.proximaDaFila)}>
                <Icone nome="play" />Iniciar a próxima da fila
              </button>
            </div>
          )}
        </>
      )}

      <hr className="popover-sep" />
      <button type="button" className="popover-item" role="menuitem" disabled={!vm.ultimaAberta} onClick={() => ir(vm.ultimaAberta)}>
        <Icone nome="repeat" /><span className="popover-texto">Continuar a última que mexi</span>
        {vm.ultimaAberta && <span className="popover-dica">{vm.ultimaAberta.codigo != null ? 'Código ' + vm.ultimaAberta.codigo : vm.ultimaAberta.nome}</span>}
      </button>
      <button type="button" className="popover-item" role="menuitem" disabled={!vm.proximaDaFila} onClick={() => ir(vm.proximaDaFila)}>
        <Icone nome="zap" /><span className="popover-texto">Iniciar a próxima da fila</span>
        {vm.proximaDaFila && <span className="popover-dica">{vm.proximaDaFila.codigo != null ? 'Código ' + vm.proximaDaFila.codigo : vm.proximaDaFila.nome}</span>}
      </button>
      <button type="button" className="popover-item" role="menuitem" disabled={!vm.paradas} onClick={() => { fechar(); vm.verParadas(); }}>
        <Icone nome="alert" /><span className="popover-texto">Ver as paradas na lista</span>
        <span className="popover-dica">{vm.paradas}</span>
      </button>
    </div>
  );
}
