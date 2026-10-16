// A moldura das janelas da entrega de documentos (16/10/2026, a cópia fiel do Entregas no visual do nads): a janela de
// "Criar registro" do catálogo (registro-novo) — no alto o caminho com o título (Rota › CLIENTE) e o ✕; embaixo do título
// a linha de apoio (a competência, "na rota", a região); o corpo; e o rodapé com as ações. Esc e o clique fora fecham.
import { Icone, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';

export function MolduraDaJanela({ icone = 'caminhao', caminho, titulo, sub, onFechar, rodape, children, classe }: {
  icone?: NomeIcone; caminho: string; titulo: string; sub?: ReactNode; onFechar: () => void; rodape?: ReactNode; children: ReactNode; classe?: string;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onFechar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onFechar]);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className={'modal registro-novo ent-janela' + (classe ? ' ' + classe : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome={icone} width={14} height={14} />{caminho}<Icone nome="chevronRight" width={14} height={14} /><b>{titulo}</b></span>
          <button type="button" className="icon-btn icon-btn-sm" onClick={onFechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>
        <div className="registro-corpo">
          {sub && <p className="registro-dica">{sub}</p>}
          {children}
        </div>
        {rodape && <footer className="registro-pe">{rodape}</footer>}
      </div>
    </div>
  );
}
