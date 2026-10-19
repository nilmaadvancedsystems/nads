// A janela da contagem de cédulas (19/10/2026, do Toriba): a quantidade de cada nota e moeda, o total ao vivo e o "Usar no
// lançamento", que abre um lançamento novo com esse valor.
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { ContadorDeCedulas } from './partes/ContadorDeCedulas';
import { useContagemDeCedulas } from './useContagemDeCedulas';

export function JanelaDeCedulas({ fechar, usar }: { fechar: () => void; usar: (valor: number) => void }) {
  const vm = useContagemDeCedulas();
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label="Contagem de cédulas">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />Caixa<Icone nome="chevronRight" /><b>Contagem de cédulas</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo"><ContadorDeCedulas quantidades={vm.quantidades} onMudar={vm.mudar} /></div>
        <footer className="registro-pe">
          <button type="button" className="btn btn-outline" onClick={vm.zerar}>Zerar</button>
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
          <button type="button" className="btn btn-primary" disabled={vm.total <= 0} onClick={() => usar(vm.total)}><Icone nome="check" />Usar no lançamento</button>
        </footer>
      </div>
    </div>
  );
}
