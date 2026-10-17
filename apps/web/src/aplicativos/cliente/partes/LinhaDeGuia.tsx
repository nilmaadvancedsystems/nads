// Uma guia em linha na Visão geral da Área do Cliente (Vitor, 16 e 17/10/2026: "quero que melhore esse layout"), como as
// "Obrigações e guias próximas" do protótipo, com as peças do nads. Versão D: uma grade de colunas fixas, igual em todas as
// linhas — a logo do órgão (40 px, sem fundo), o nome com a competência e o vencimento, o selo da situação (largura fixa,
// alinhado à esquerda), o valor (largura fixa, à direita, tabular) e as ações (largura fixa, alinhadas à direita), para os
// selos e os valores ficarem em fila. Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO } from './guia';
import { SiglaDaGuia } from './SiglaDaGuia';

export function LinhaDeGuia({ guia, codigo, ocupado, onBaixar, onCopiar }: { guia: ac.GuiaDoCliente; codigo?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void }) {
  return (
    <li className="cli-linha cli-linha-guia">
      <span className="cli-g-logo"><SiglaDaGuia tipo={guia.tipo} tamanho={40} /></span>
      <div className="cli-g-txt">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]}</b>
        <p className="hint">Competência {guia.competencia.slice(5, 7)}/{guia.competencia.slice(0, 4)} · {guia.situacao === 'vencida' ? 'venceu' : 'vence'} em {guia.vencimento}</p>
      </div>
      <span className="cli-g-selo"><span className={SELO_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span></span>
      <span className="cli-g-valor cli-valor">{formatos.reais(guia.valor)}</span>
      <span className="cli-g-acoes">
        {codigo && onCopiar && (
          <button type="button" className="icon-btn" title="Copiar a linha digitável" aria-label="Copiar a linha digitável" onClick={() => onCopiar(codigo)}>
            <Icone nome="copiar" width={16} height={16} />
          </button>
        )}
        <button type="button" className="icon-btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} title="Baixar a guia" aria-label={'Baixar a guia ' + ac.ROTULO_DA_GUIA[guia.tipo]}>
          <Icone nome="download" width={16} height={16} />
        </button>
      </span>
    </li>
  );
}
