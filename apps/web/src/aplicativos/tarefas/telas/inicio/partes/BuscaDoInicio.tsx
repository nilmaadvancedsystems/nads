// A busca do alto do Início novo, uma só na tela (o print: a busca abre a caixa com "Add filters"): a busca curta e, com ela
// em foco, a caixa com as pílulas da aba aberta (chip-f) e, nas Tarefas e nos Documentos, o Cliente (o menu com a busca; o
// escolhido vira a pílula ligada, com o ×). No Painel a caixa mostra as tarefas achadas (clicar abre); nas outras abas, a
// busca e as pílulas filtram a própria lista. Com filtro ligado, a pílula "N filtros" ao lado tira todos. O Esc limpa e fecha.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import type { useInicioNovo } from '../useInicioNovo';

function EscolherCliente({ vm }: { vm: ReturnType<typeof useInicioNovo> }) {
  const [q, setQ] = useState('');
  const achados = (q.trim() ? vm.clientes.filter(c => c.toLowerCase().includes(q.trim().toLowerCase())) : vm.clientes).slice(0, 80);
  if (vm.cliente) {
    return (
      <button type="button" className="chip-f on" title="Tirar o filtro do cliente" onClick={() => vm.escolherCliente('')}>
        <Icone nome="briefcase" width={14} height={14} /><span className="ini-empresa">{vm.cliente}</span><Icone nome="x" width={12} height={12} />
      </button>
    );
  }
  return (
    <MenuSuspenso rotulo="Cliente" icone="briefcase" className="chip-f" titulo="Filtrar pelo cliente" flutuante largura={360}
      conteudo={fechar => (
        <>
          <label className="busca-curta larga">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar pelo nome ou código" aria-label="Buscar o cliente" value={q} onChange={ev => setQ(ev.target.value)}
              ref={el => { if (el && document.activeElement !== el) setTimeout(() => el.focus(), 0); }}
              onKeyDown={ev => { if (ev.key === 'Enter' && achados.length === 1) { fechar(); vm.escolherCliente(achados[0]); setQ(''); } }} />
          </label>
          <div className="menu-busca-lista">
            {achados.map(c => (
              <button key={c} type="button" className="popover-item" onClick={() => { fechar(); vm.escolherCliente(c); setQ(''); }}>
                <span className="popover-texto">{c}</span>
              </button>
            ))}
            {!achados.length && <p className="hint">{vm.clientes.length ? 'Nenhum cliente com essa busca.' : 'Nenhuma tarefa com cliente.'}</p>}
          </div>
        </>
      )} />
  );
}

export function BuscaDoInicio({ vm }: { vm: ReturnType<typeof useInicioNovo> }) {
  const [aberta, setAberta] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberta) return;
    // o menu do cliente abre fora da caixa (flutuante): clicar nele não fecha a busca
    const fora = (ev: MouseEvent) => { const t = ev.target as Element; if (!caixa.current?.contains(t) && !t.closest?.('.menu-pop.flutuante')) setAberta(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberta]);
  const abrir = (id: string) => { setAberta(false); vm.abrir(id); };
  const noPainel = vm.aba === 'painel';
  return (
    <div className="popover-wrap ini-busca" ref={caixa}>
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" placeholder={vm.placeholder} aria-label={vm.placeholder} value={vm.busca}
          onFocus={() => setAberta(true)} onChange={ev => { vm.setBusca(ev.target.value); setAberta(true); }}
          onKeyDown={ev => {
            if (ev.key === 'Escape') { vm.limparBusca(); setAberta(false); }
            if (ev.key === 'Enter' && noPainel && vm.achados[0]) abrir(vm.achados[0].id);
          }} />
      </label>
      {aberta && (
        <div className="popover menu-pop ini-busca-pop" role="dialog" aria-label="Filtrar">
          <p className="popover-label">Filtrar</p>
          <div className="chip-row">
            {vm.filtrosDaBusca.map(f => (
              <button key={f.id} type="button" className={'chip-f' + (f.ligado ? ' on' : '')} aria-pressed={f.ligado} onClick={() => vm.alternarFiltro(f.id)}>
                <Icone nome={f.icone} width={14} height={14} />{f.rotulo}
              </button>
            ))}
            {vm.comCliente && <EscolherCliente vm={vm} />}
          </div>
          {noPainel && vm.buscando && (
            <>
              <hr className="popover-sep" />
              <p className="popover-label">Tarefas</p>
              {vm.achados.map(t => (
                <button key={t.id} type="button" className="popover-item" onClick={() => abrir(t.id)}>
                  <Icone nome={t.feita ? 'checkCircle' : 'checklist'} />
                  <span className="popover-texto">{t.titulo}{t.detalhe && <><br /><span className="hint">{t.detalhe}</span></>}</span>
                </button>
              ))}
              {!vm.achados.length && <p className="hint ini-busca-vazio">Nenhuma tarefa com isso.</p>}
            </>
          )}
          {vm.buscando && (
            <>
              <hr className="popover-sep" />
              <button type="button" className="popover-item" onClick={() => { vm.limparBusca(); }}><Icone nome="x" /><span className="popover-texto">Limpar a busca e os filtros</span></button>
            </>
          )}
        </div>
      )}
      {!aberta && vm.quantosFiltros > 0 && (
        <button type="button" className="chip-f on ini-busca-ligados" title="Tirar os filtros" onClick={vm.limparBusca}>
          {vm.quantosFiltros === 1 ? '1 filtro' : vm.quantosFiltros + ' filtros'}<Icone nome="x" width={12} height={12} />
        </button>
      )}
    </div>
  );
}
