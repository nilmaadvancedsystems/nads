// A busca do alto do Início novo (o print: a busca abre a caixa com "Add filters" e as tarefas achadas): a busca curta e,
// com ela em foco, a caixa com as pílulas (chip-f) e as tarefas que batem; clicar abre a tarefa. O Esc limpa e fecha.
import { Icone } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import type { useInicioNovo } from '../useInicioNovo';

export function BuscaDoInicio({ vm }: { vm: ReturnType<typeof useInicioNovo> }) {
  const [aberta, setAberta] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberta) return;
    const fora = (e: MouseEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberta(false); };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberta]);
  const abrir = (id: string) => { setAberta(false); vm.abrir(id); };
  return (
    <div className="popover-wrap ini-busca" ref={caixa}>
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" placeholder="Buscar nas tarefas" aria-label="Buscar nas tarefas (número, título, descrição, cliente)" value={vm.busca}
          onFocus={() => setAberta(true)} onChange={e => { vm.setBusca(e.target.value); setAberta(true); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { vm.limparBusca(); setAberta(false); }
            if (e.key === 'Enter' && vm.achados[0]) abrir(vm.achados[0].id);
          }} />
      </label>
      {aberta && (
        <div className="popover menu-pop ini-busca-pop" role="dialog" aria-label="Busca nas tarefas">
          <p className="popover-label">Filtrar</p>
          <div className="chip-row">
            {vm.filtrosDaBusca.map(f => (
              <button key={f.id} type="button" className={'chip-f' + (f.ligado ? ' on' : '')} aria-pressed={f.ligado} onClick={() => vm.alternarFiltro(f.id)}>
                <Icone nome={f.icone} width={14} height={14} />{f.rotulo}
              </button>
            ))}
          </div>
          {vm.buscando && (
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
              <hr className="popover-sep" />
              <button type="button" className="popover-item" onClick={() => { vm.limparBusca(); }}><Icone nome="x" /><span className="popover-texto">Limpar a busca</span></button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
