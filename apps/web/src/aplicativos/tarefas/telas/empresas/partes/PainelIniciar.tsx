// O painel do botão "Iniciar", no jeito do "Code ▾" do GitHub: abas em cima (Empresas / Recentes) e, na
// mesma linha, "Iniciar em lote"; o filtro rápido e a busca, a lista (caixinha para o lote, código e nome;
// clicar no nome inicia só aquela) e, embaixo, os atalhos. Recentes: as acessadas nos últimos 3 dias.
// Em lote (duas ou mais marcadas), abre uma aba do navegador para cada empresa.
import { Icone, Segmentado, useRetorno } from '@nads/ui';
import type { useMinhasEmpresas } from '../useMinhasEmpresas';

type Vm = ReturnType<typeof useMinhasEmpresas>;
type Linha = Vm['paraIniciar'][number];

function Lista({ vm, linhas, onEscolher }: { vm: Vm; linhas: Linha[]; onEscolher: (l: Linha) => void }) {
  return (
    <div className="iniciar-lista">
      {linhas.map(l => (
        <div key={l.chave} className={'iniciar-linha' + (vm.marcadaNoLote(l.rota) ? ' marcada' : '')}>
          <input type="checkbox" checked={vm.marcadaNoLote(l.rota)} onChange={() => vm.alternarNoLote(l.rota)}
            aria-label={'Marcar ' + l.nome + ' para iniciar em lote'} title="Marcar para iniciar em lote" />
          <button type="button" className="popover-item iniciar-item" role="menuitem" onClick={() => onEscolher(l)}>
            <span className="num hint">{l.codigo ?? '—'}</span>
            <span className="iniciar-nome">{l.nome}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

export function PainelIniciar({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const { toast } = useRetorno();
  const ir = (l: Linha | null) => { if (!l) return; fechar(); vm.iniciar(l.rota); };
  /** uma aba do navegador por empresa marcada (se o navegador bloquear, avisa para liberar as janelas) */
  const emLote = () => {
    const enderecos = vm.enderecosDoLote();
    const abertas = enderecos.map(e => window.open(new URL(e, window.location.href).href, '_blank')).filter(Boolean).length;
    fechar();
    toast(abertas < enderecos.length
      ? 'O navegador bloqueou ' + (enderecos.length - abertas) + ' aba(s): libere as janelas pop-up deste site e tente de novo.'
      : abertas + ' empresas abertas, uma em cada aba.');
  };
  return (
    <div className="iniciar-pop">
      <div className="iniciar-abas" role="tablist">
        <button type="button" role="tab" className="iniciar-aba" aria-selected={vm.abaIniciar === 'escolher'} onClick={() => vm.setAbaIniciar('escolher')}>Empresas</button>
        <button type="button" role="tab" className="iniciar-aba" aria-selected={vm.abaIniciar === 'recentes'} onClick={() => vm.setAbaIniciar('recentes')}>Recentes</button>
        <button type="button" className="btn btn-primary btn-sm iniciar-lote" disabled={!vm.podeIniciarEmLote} onClick={emLote}
          title={vm.podeIniciarEmLote ? 'Abrir uma aba para cada empresa marcada' : 'Marque duas ou mais empresas'}>
          Iniciar em lote{vm.lote.length ? ' (' + vm.lote.length + ')' : ''}
        </button>
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
            : <Lista vm={vm} linhas={vm.paraIniciar} onEscolher={ir} />}
          {vm.totalParaIniciar > vm.paraIniciar.length && (
            <p className="hint iniciar-nada">Mostrando {vm.paraIniciar.length} de {vm.totalParaIniciar}. Digite para achar as outras.</p>
          )}
        </>
      ) : (
        <>
          {vm.recentes.length ? <Lista vm={vm} linhas={vm.recentes} onEscolher={ir} /> : (
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
