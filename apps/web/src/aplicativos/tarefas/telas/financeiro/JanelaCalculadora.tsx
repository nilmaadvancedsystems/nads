// A janela da calculadora (19/10/2026: "uma calculadora funcional"): as teclas na tela e no teclado, e o "Usar no
// lançamento", que abre um lançamento novo com o resultado (como a contagem de cédulas).
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { Calculadora } from './partes/Calculadora';
import { useCalculadora } from './useCalculadora';

export function JanelaCalculadora({ fechar, usar }: { fechar: () => void; usar: (valor: number) => void }) {
  const vm = useCalculadora();
  const { teclarDoTeclado } = vm;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  // o teclado: números, vírgula ou ponto, + - * /, %, Enter, Backspace e C; o Enter não pode apertar também o botão com o foco
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (!e.ctrlKey && !e.metaKey && !e.altKey && teclarDoTeclado(e.key)) e.preventDefault(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [teclarDoTeclado]);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo fin-calc-janela" role="dialog" aria-modal="true" aria-label="Calculadora">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />Caixa<Icone nome="chevronRight" /><b>Calculadora</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo"><Calculadora estado={vm.estado} aoTecla={vm.teclar} /></div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
          <button type="button" className="btn btn-primary" disabled={vm.resultado <= 0} onClick={() => usar(vm.resultado)}><Icone nome="check" />Usar no lançamento</button>
        </footer>
      </div>
    </div>
  );
}
