// O menu do canto do executor com abas, como o "Code ▾" do GitHub (Vitor, 02/10/2026): Tarefas (os grupos da rotina:
// o da vez marcado, os da frente travados) e, quando está em lote, Em lote (o período e as configurações da função:
// alterar e cancelar — só na Importação; cancelar em vermelho).
import { Icone, type ItemMenu } from '@nads/ui';
import { useState } from 'react';

export function MenuDaRotina({ grupos, emLote, fechar }: {
  grupos: ItemMenu[];
  emLote: { rotulo: string; onAlterar: (() => void) | null; onCancelar: (() => void) | null } | null;
  fechar: () => void;
}) {
  const [aba, setAba] = useState<'tarefas' | 'lote'>('tarefas');
  const naAba = emLote ? aba : 'tarefas';
  return (
    <div className="rotina-menu">
      {emLote && <div className="iniciar-abas comp-abas" role="tablist">
        <button type="button" role="tab" className="iniciar-aba" aria-selected={naAba === 'tarefas'} onClick={() => setAba('tarefas')}>Tarefas</button>
        <button type="button" role="tab" className="iniciar-aba" aria-selected={naAba === 'lote'} onClick={() => setAba('lote')}>Em lote</button>
      </div>}
      {naAba === 'tarefas' ? (
        <div role="menu">
          {grupos.map((it, i) => it === 'separador' ? <hr key={i} className="popover-sep" /> : (
            <button key={i} type="button" className="popover-item" role="menuitem" disabled={it.desabilitado} onClick={() => { fechar(); it.onClick(); }}>
              <span className="popover-marca">{it.marcado && <Icone nome="check" />}</span>
              {it.icone && <Icone nome={it.icone} />}
              <span className="popover-texto">{it.rotulo}</span>
            </button>
          ))}
        </div>
      ) : emLote && (
        <div role="menu">
          <p className="rotina-lote-periodo"><Icone nome="calendar" />{emLote.rotulo}</p>
          {emLote.onAlterar && (
            <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); emLote.onAlterar?.(); }}>
              <Icone nome="settings" /><span className="popover-texto">Alterar o período</span>
            </button>
          )}
          {emLote.onCancelar ? (
            <>
              <hr className="popover-sep" />
              <button type="button" className="popover-item perigo" role="menuitem" onClick={() => { fechar(); emLote.onCancelar?.(); }}>
                <Icone nome="x" /><span className="popover-texto">Cancelar o Em lote</span>
              </button>
            </>
          ) : <p className="hint rotina-lote-nota">Alterar e cancelar só na Importação.</p>}
        </div>
      )}
    </div>
  );
}
