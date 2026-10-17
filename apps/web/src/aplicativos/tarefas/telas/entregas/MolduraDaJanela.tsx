// A moldura das janelas da entrega de documentos (16/10/2026, a cópia fiel do Entregas no visual do nads): a janela de
// "Criar registro" do catálogo (registro-novo) — no alto o caminho com o título (Rota › CLIENTE) e o ✕; embaixo do título
// a linha de apoio (a competência, "na rota", a região); o corpo; e o rodapé com as ações. Esc e o clique fora fecham.
import { BotaoFechar, Icone, useJanela, type NomeIcone } from '@nads/ui';
import { useRef, type ReactNode } from 'react';

export function MolduraDaJanela({ icone = 'caminhao', caminho, titulo, sub, onFechar, rodape, children, classe }: {
  icone?: NomeIcone; caminho: string; titulo: string; sub?: ReactNode; onFechar: () => void; rodape?: ReactNode; children: ReactNode; classe?: string;
}) {
  // revisão da UI (16/10/2026, como os commits 707009b0 e 3ac496fb): Esc, foco preso e o foco de volta pela peça useJanela
  // (antes, um Esc à mão); com a janela do cliente por baixo, só a de cima responde
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, onFechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={janela} className={'modal registro-novo ent-janela' + (classe ? ' ' + classe : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome={icone} width={14} height={14} />{caminho}<Icone nome="chevronRight" width={14} height={14} /><b>{titulo}</b></span>
          <BotaoFechar onClick={onFechar} />
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
