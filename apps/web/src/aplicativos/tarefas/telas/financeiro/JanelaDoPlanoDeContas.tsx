// O Plano de contas numa janela, pelo Configurar das Configurações do Financeiro (Vitor, 19/11/2026: "Deixa em configuracoes, um
// botao configurar, que abre uma popup desse plano de contas"): a mesma tela, com a busca, o Exportar e a Nova conta.
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { PlanoDeContas } from './PlanoDeContas';

export function JanelaDoPlanoDeContas({ fechar }: { fechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo janela-plano" role="dialog" aria-modal="true" aria-label="Plano de contas">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="settings" />Configurações<Icone nome="chevronRight" /><b>Plano de contas</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo"><PlanoDeContas /></div>
      </div>
    </div>
  );
}
