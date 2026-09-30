// O painel do botão "Iniciar", no jeito do "Code ▾" do GitHub: abas em cima (Empresas / Recentes) e, na
// mesma linha, "Iniciar em lote"; o filtro rápido e a busca, a lista (caixinha para o lote, código e nome;
// clicar no nome inicia só aquela) Recentes: as acessadas nos últimos 3 dias e, embaixo, os atalhos.
// Em lote (duas ou mais marcadas), abre uma aba do navegador para cada empresa. O navegador só deixa abrir
// uma aba por clique: as que ele bloquear ficam no painel, um botão para cada (cada clique abre uma).
import { Icone, Segmentado, useRetorno } from '@nads/ui';
import { useState } from 'react';
import type { useMinhasEmpresas } from '../useMinhasEmpresas';

type Vm = ReturnType<typeof useMinhasEmpresas>;
type Linha = Vm['paraIniciar'][number];

/** A lista do painel; a caixinha do lote só na aba Empresas. */
function Lista({ vm, linhas, onEscolher, comLote }: { vm: Vm; linhas: Linha[]; onEscolher: (l: Linha) => void; comLote?: boolean }) {
  return (
    <div className="iniciar-lista">
      {linhas.map(l => (
        <div key={l.chave} className={'iniciar-linha' + (comLote && vm.marcadaNoLote(l.rota) ? ' marcada' : '')}>
          {comLote && (
            <input type="checkbox" checked={vm.marcadaNoLote(l.rota)} onChange={() => vm.alternarNoLote(l.rota)}
              aria-label={'Marcar ' + l.nome + ' para iniciar em lote'} title="Marcar para iniciar em lote" />
          )}
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
  const [faltam, setFaltam] = useState<{ endereco: string; rotulo: string }[]>([]);
  const abrirAba = (endereco: string) => { const w = window.open(new URL(endereco, window.location.href).href, '_blank'); return !!w && !w.closed; };
  const emLote = () => {
    const marcadas = vm.enderecosDoLote();
    const bloqueadas = marcadas.filter(m => !abrirAba(m.endereco));
    if (!bloqueadas.length) { fechar(); toast(marcadas.length + ' empresas abertas, uma em cada aba.'); return; }
    setFaltam(bloqueadas);
  };
  const abrirUma = (m: { endereco: string; rotulo: string }) => {
    abrirAba(m.endereco);
    const resto = faltam.filter(f => f !== m);
    setFaltam(resto);
    if (!resto.length) fechar();
  };
  return (
    <div className="iniciar-pop">
      <div className="iniciar-abas" role="tablist">
        <button type="button" role="tab" className="iniciar-aba" aria-selected={vm.abaIniciar === 'escolher'} onClick={() => vm.setAbaIniciar('escolher')}>Empresas</button>
        <button type="button" role="tab" className="iniciar-aba" aria-selected={vm.abaIniciar === 'recentes'} onClick={() => vm.setAbaIniciar('recentes')}>Recentes</button>
        {/* o lote é só da aba Empresas (onde se marca) */}
        {vm.abaIniciar === 'escolher' && (
          <button type="button" className="btn btn-primary btn-sm iniciar-lote" disabled={!vm.podeIniciarEmLote} onClick={emLote}
            title={vm.podeIniciarEmLote ? 'Abrir uma aba para cada empresa marcada' : 'Marque duas ou mais empresas'}>
            Iniciar em lote{vm.lote.length ? ' (' + vm.lote.length + ')' : ''}
          </button>
        )}
      </div>

      {faltam.length > 0 && (
        <div className="iniciar-faltam">
          <p className="hint">O navegador abriu só uma aba. Clique para abrir as outras (ou libere as janelas pop-up deste site, no ícone da barra de endereço, para abrir todas de uma vez):</p>
          {faltam.map(m => (
            <button key={m.endereco} type="button" className="popover-item" onClick={() => abrirUma(m)}>
              <Icone nome="play" /><span className="popover-texto">Abrir {m.rotulo}</span>
            </button>
          ))}
        </div>
      )}

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
            : <Lista vm={vm} linhas={vm.paraIniciar} onEscolher={ir} comLote />}
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
            </div>
          )}
          <Atalhos vm={vm} ir={ir} fechar={fechar} />
        </>
      )}

    </div>
  );
}

/** Os atalhos (só na aba Recentes): continuar a última, a próxima da fila e as paradas. */
function Atalhos({ vm, ir, fechar }: { vm: Vm; ir: (l: Linha | null) => void; fechar: () => void }) {
  return (
    <>
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
    </>
  );
}
