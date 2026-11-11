// A DANFE idêntica à original numa janela (11/11/2026, no LCDPR: "a danfe que tem que ficar identica a danfe original"):
// o PDF desenhado do XML (o mesmo do robô, medido dos PDFs do portal do SIEG) aparece como a folha, branca sobre o cinza,
// na largura da janela; no topo, o zoom (−, +, ajustar) e baixar o PDF e o XML. Sem o leitor de PDF do navegador (a barra
// de impressão e as miniaturas; 11/11/2026: "coloca o vizualizador de verdade nao esse trem de impressao"). Enquanto o robô busca a nota, o andamento; sem a nota, o motivo e o "Tentar de novo". Esc fecha.
import type { tarefas as t } from '@nads/core';
import { BotaoFechar, Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { useDanfeOriginal } from './useDanfeOriginal';

export function JanelaDaDanfe({ nota, codigo, competencia, fechar }: { nota: t.sieg.NotaDoSieg; codigo?: string | number | null; competencia?: string; fechar: () => void }) {
  const vm = useDanfeOriginal(nota, codigo, competencia);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal registro-novo danfe-pdf-janela" role="dialog" aria-modal="true" aria-label={'DANFE ' + vm.titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />DANFE<Icone nome="chevronRight" /><b>{vm.titulo}</b><span className="fraco">{vm.emitente}</span></span>
          <span className="danfe-pdf-acoes">
            {vm.pronta && (
              <span className="danfe-zoom" role="group" aria-label="Zoom">
                <button type="button" className="btn btn-ghost" aria-label="Diminuir" title="Diminuir" onClick={vm.menos}>−</button>
                <button type="button" className="btn btn-ghost danfe-zoom-valor" title="Ajustar à largura" onClick={vm.ajustar}>{vm.rotuloDoZoom}</button>
                <button type="button" className="btn btn-ghost" aria-label="Aumentar" title="Aumentar" onClick={vm.mais}>+</button>
              </span>
            )}
            <button type="button" className="btn btn-outline" disabled={!vm.pronta} onClick={vm.baixarPdf}><Icone nome="download" />PDF</button>
            <button type="button" className="btn btn-outline" disabled={!vm.pronta} onClick={vm.baixarXml}><Icone nome="download" />XML</button>
          </span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="danfe-pdf-corpo">
          {vm.pronta ? (
            <div className={'danfe-folhas' + (vm.zoom === 'largura' ? ' ajustada' : '')}>
              {vm.folhas.map((f, k) => (
                <img key={f} src={f} alt={'DANFE ' + vm.titulo + ', folha ' + (k + 1)} className="danfe-folha"
                  style={vm.zoom === 'largura' ? undefined : { width: (vm.zoom * 8.27) + 'px' }} />
              ))}
            </div>
          )
            : vm.erro ? (
              <div className="danfe-pdf-aviso">
                <Icone nome="alert" />
                <p>{vm.erro}</p>
                <button type="button" className="btn btn-outline" onClick={vm.tentarDeNovo}><Icone nome="girar" />Tentar de novo</button>
              </div>
            ) : (
              <div className="danfe-pdf-aviso"><span className="btn-spinner" aria-hidden="true" /><p>{vm.andamento}</p></div>
            )}
        </div>
      </div>
    </div>
  );
}
