// As impressões e os materiais (os Insumos) numa janela, na tela da Carteira (Vitor, 19/11/2026: "insumos tbm pode deixar na tela
// inicial, com um botao de registrar insumo (coloca outro nome mais intuitivo) abre uma popup que aparece a lista de lancamentos"):
// a mesma tela dos Insumos, com o Registrar e a lista do mês.
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { Insumos } from './Insumos';

/** mes: o mês da tela da Carteira (sem outro seletor aqui; 19/11/2026) */
export function JanelaDeMateriais({ fechar, mes }: { fechar: () => void; mes: string }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo janela-materiais" role="dialog" aria-modal="true" aria-label="Impressões e materiais">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />Carteira<Icone nome="chevronRight" /><b>Impressões e materiais</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo"><Insumos emJanela mes={mes} /></div>
      </div>
    </div>
  );
}
