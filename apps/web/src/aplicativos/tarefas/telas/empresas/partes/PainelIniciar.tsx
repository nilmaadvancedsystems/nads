// O painel do botão "Iniciar", no jeito do "Code ▾" do GitHub: abas em cima (Empresas / Recentes / Em lote).
// Empresas: o filtro rápido, a busca e a lista (clicar inicia aquela). Recentes: as acessadas nos últimos 3 dias
// e, embaixo, os atalhos. Em lote: a busca e o "+" em cada empresa, que a põe na lista de cima; "Abrir N abas"
// abre uma aba do navegador para cada uma. O navegador só deixa abrir
// uma aba por clique: as que ele bloquear ficam no painel, um botão para cada (cada clique abre uma).
import { Icone, Segmentado, useRetorno } from '@nads/ui';
import { useState } from 'react';
import type { useMinhasEmpresas } from '../useMinhasEmpresas';

type Vm = ReturnType<typeof useMinhasEmpresas>;
type Linha = Vm['paraIniciar'][number];

/** A lista do painel (Empresas e Recentes): clicar inicia aquela empresa. */
function Lista({ linhas, onEscolher }: { linhas: Linha[]; onEscolher: (l: Linha) => void }) {
  return (
    <div className="iniciar-lista">
      {linhas.map(l => (
        <div key={l.chave} className="iniciar-linha">
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
        <button type="button" role="tab" className="iniciar-aba" aria-selected={vm.abaIniciar === 'lote'} onClick={() => vm.setAbaIniciar('lote')}>
          Em lote{vm.lote.length > 0 && <span className="iniciar-lote-qtd">{vm.lote.length}</span>}
        </button>
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
            : <Lista linhas={vm.paraIniciar} onEscolher={ir} />}
          {vm.totalParaIniciar > vm.paraIniciar.length && (
            <p className="hint iniciar-nada">Mostrando {vm.paraIniciar.length} de {vm.totalParaIniciar}. Digite para achar as outras.</p>
          )}
        </>
      ) : vm.abaIniciar === 'lote' ? (
        <>
          {/* a lista do lote (o que o "+" pôs), com × para tirar, e o botão de abrir */}
          {vm.loteLinhas.length > 0 ? (
            <div className="lote-lista">
              <div className="lote-topo">
                <span className="hint">Para abrir ({vm.loteLinhas.length})</span>
                <button type="button" className="btn btn-primary btn-sm" disabled={!vm.podeIniciarEmLote} onClick={emLote}
                  title={vm.podeIniciarEmLote ? 'Abrir uma aba do navegador para cada empresa' : 'Ponha duas ou mais empresas'}>
                  <Icone nome="play" />{vm.podeIniciarEmLote ? 'Abrir ' + vm.loteLinhas.length + ' abas' : 'Ponha mais uma'}
                </button>
              </div>
              <div className="lote-chips">
                {vm.loteLinhas.map(l => (
                  <span key={l.chave} className="lote-chip" title={l.nome}>
                    <span className="num">{l.codigo ?? '—'}</span><span className="lote-chip-nome">{l.nome}</span>
                    <button type="button" aria-label={'Tirar ' + l.nome + ' do lote'} onClick={() => vm.tirarDoLote(l.rota)}><Icone nome="x" /></button>
                  </span>
                ))}
              </div>
            </div>
          ) : <p className="hint lote-vazio">Ponha as empresas no lote pelo <b>+</b>. Depois, "Abrir" abre uma aba para cada uma.</p>}
          <label className="busca-curta larga">
            <Icone nome="search" />
            <input type="text" autoFocus placeholder="Nome ou código" aria-label="Buscar empresa para o lote (nome ou código)" value={vm.buscaIniciar}
              onChange={e => vm.setBuscaIniciar(e.target.value)}
              onKeyDown={e => { const l = vm.paraIniciar.find(x => !vm.marcadaNoLote(x.rota)); if (e.key === 'Enter' && l) vm.alternarNoLote(l.rota); }} />
          </label>
          <div className="iniciar-lista">
            {vm.paraIniciar.map(l => {
              const noLote = vm.marcadaNoLote(l.rota);
              return (
                <div key={l.chave} className={'iniciar-linha lote-linha' + (noLote ? ' marcada' : '')}>
                  <span className="num hint">{l.codigo ?? '—'}</span>
                  <span className="iniciar-nome">{l.nome}</span>
                  <button type="button" className={'icon-btn icon-btn-sm lote-mais' + (noLote ? ' no-lote' : '')} onClick={() => vm.alternarNoLote(l.rota)}
                    title={noLote ? 'Tirar do lote' : 'Pôr no lote'} aria-label={(noLote ? 'Tirar ' : 'Pôr ') + l.nome + (noLote ? ' do lote' : ' no lote')}>
                    <Icone nome={noLote ? 'check' : 'plus'} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {vm.recentes.length ? <Lista linhas={vm.recentes} onEscolher={ir} /> : (
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
