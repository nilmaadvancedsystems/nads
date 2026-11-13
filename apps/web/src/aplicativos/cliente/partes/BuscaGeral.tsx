// A busca geral da Área do Cliente (13/11/2026: "busca geral"): a janela que abre pelo botão do topo, pelo Ctrl+K ou pela
// barra "/" no computador. O campo no alto e os achados em grupos (Telas, Guias, Documentos, Solicitações,
// Funcionários); as setas andam pelos achados, o Enter abre e o Esc fecha. A regra está em dados/busca.ts.
import { Icone, useJanela } from '@nads/ui';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buscarNaArea, type ItemDaBusca } from '../dados/busca';

export function BuscaGeral({ indice, onEscolher, onFechar }: { indice: readonly ItemDaBusca[]; onEscolher: (i: ItemDaBusca) => void; onFechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, onFechar);
  const [termo, setTermo] = useState('');
  const [foco, setFoco] = useState(0);
  const grupos = useMemo(() => buscarNaArea(indice, termo), [indice, termo]);
  const lista = grupos.flatMap(g => g.itens);
  const atual = Math.min(foco, Math.max(lista.length - 1, 0));

  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFoco(Math.min(atual + 1, lista.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFoco(Math.max(atual - 1, 0)); }
    if (e.key === 'Enter' && lista[atual]) { e.preventDefault(); onEscolher(lista[atual]); }
  };

  return createPortal(
    <div className="modal-overlay cli-busca-fundo" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={janela} className="cli-app cli-busca-janela" role="dialog" aria-modal="true" aria-label="Buscar na área">
        <label className="cli-busca-campo">
          <Icone nome="search" width={18} height={18} />
          <input autoFocus type="text" value={termo} onChange={e => { setTermo(e.target.value); setFoco(0); }} onKeyDown={tecla}
            placeholder="Buscar guia, documento, solicitação ou funcionário" aria-label="Buscar" role="combobox" aria-expanded="true" aria-controls="cli-busca-achados"
            aria-activedescendant={lista[atual] ? 'cli-busca-' + lista[atual].chave : undefined} />
          <kbd className="cli-tecla">Esc</kbd>
        </label>
        <div className="cli-busca-achados" id="cli-busca-achados" role="listbox">
          {grupos.length ? grupos.map(g => (
            <div key={g.grupo} className="cli-busca-grupo" role="group" aria-label={g.grupo}>
              <p className="cli-busca-grupo-titulo">{g.grupo}</p>
              {g.itens.map(i => {
                const k = lista.indexOf(i);
                return (
                  <button key={i.chave} id={'cli-busca-' + i.chave} type="button" role="option" aria-selected={k === atual} className={'cli-busca-item' + (k === atual ? ' foco' : '')}
                    onMouseMove={() => setFoco(k)} onClick={() => onEscolher(i)}>
                    <span className="cli-busca-item-ico" aria-hidden="true"><Icone nome={i.icone} width={16} height={16} /></span>
                    <span className="cli-busca-item-txt"><b>{i.titulo}</b><span>{i.detalhe}</span></span>
                    <Icone nome="chevronRight" width={14} height={14} className="cli-busca-item-seta" />
                  </button>
                );
              })}
            </div>
          )) : <p className="hint cli-busca-nada">Nada com "{termo}". Tente outra palavra.</p>}
        </div>
        <p className="cli-busca-rodape"><span><kbd className="cli-tecla">↑</kbd><kbd className="cli-tecla">↓</kbd> andar</span><span><kbd className="cli-tecla">Enter</kbd> abrir</span></p>
      </div>
    </div>,
    document.body,
  );
}
