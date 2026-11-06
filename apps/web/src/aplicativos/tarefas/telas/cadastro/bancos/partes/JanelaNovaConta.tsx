// "Nova conta" numa janela no centro da tela, por cima de tudo (Vitor, 06/11/2026: no balão, clicar fora fechava e
// perdia o que estava escolhendo). Clicar fora não fecha: só o ✕ (ou o Esc).
import type { empresas } from '@nads/core';
import { BotaoFechar, Esqueleto, useJanela } from '@nads/ui';
import { useRef } from 'react';
import type { VmContasBancarias } from '../useContasBancarias';
import { FormConta } from './FormConta';

export function JanelaNovaConta({ vm, inicial, fechar }: { vm: VmContasBancarias; inicial?: empresas.cadastro.DadosDaConta; fechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal cad-nova-conta" role="dialog" aria-modal="true" aria-label="Nova conta">
        <h3 className="pedir-titulo">Nova conta<BotaoFechar className="pedir-x" onClick={fechar} /></h3>
        <div className="cad-nova-conta-corpo">
          {vm.carregando ? <Esqueleto linhas={2} /> : <FormConta vm={vm} id={null} inicial={inicial} fechar={fechar} />}
        </div>
      </div>
    </div>
  );
}
