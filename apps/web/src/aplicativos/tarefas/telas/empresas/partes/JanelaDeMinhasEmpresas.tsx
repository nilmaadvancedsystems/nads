// As Justificativas (as etapas paradas, com o motivo) e as Configurações (os históricos do Creditor) de Minhas empresas, em
// janela (Vitor, 28/10/2026: "remover esse menu superior e colocar uns ícones de botões de justificativas e configurações
// aparecer uma popup"). Fecha no ×, clicando fora ou no Esc.
import { BotaoFechar, Icone, useJanela, type NomeIcone } from '@nads/ui';
import { useRef, type ReactNode } from 'react';

export function JanelaDeMinhasEmpresas({ titulo, icone, fechar, children }: { titulo: string; icone: NomeIcone; fechar: () => void; children: ReactNode }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal pedir-historico janela-minhas-empresas" role="dialog" aria-modal="true" aria-labelledby="janelaMinhasEmpresas">
        <h3 id="janelaMinhasEmpresas" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icone nome={icone} width={16} height={16} />{titulo}
          <span style={{ flex: 1 }} />
          <BotaoFechar onClick={fechar} />
        </h3>
        <div style={{ padding: 16, maxHeight: '70vh', overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  );
}
