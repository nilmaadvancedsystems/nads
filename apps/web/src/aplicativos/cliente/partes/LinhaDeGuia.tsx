// Uma guia em linha na Visão geral da Área do Cliente (Vitor, 16/10/2026), como as "Obrigações e guias próximas" do
// protótipo, com as peças do nads. Versão D: a logo do órgão (ou a sigla) no quadradinho claro, o nome e o vencimento, o selo da situação, o valor
// alinhado à direita em número tabular, baixar e copiar a linha digitável (quando tem). Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO } from './guia';
import { SiglaDaGuia } from './SiglaDaGuia';

export function LinhaDeGuia({ guia, codigo, ocupado, onBaixar, onCopiar }: { guia: ac.GuiaDoCliente; codigo?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void }) {
  return (
    <li className="cli-linha">
      <SiglaDaGuia tipo={guia.tipo} />
      <div className="cli-linha-txt">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]}</b>
        <p className="hint">Competência {guia.competencia.slice(5, 7)}/{guia.competencia.slice(0, 4)} · {guia.situacao === 'vencida' ? 'venceu' : 'vence'} em {guia.vencimento}</p>
      </div>
      <div className="cli-linha-dir">
        <span className={SELO_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>
        <span className="cli-valor cli-linha-valor">{formatos.reais(guia.valor)}</span>
        <span className="cli-linha-acoes">
          <button type="button" className="icon-btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} title="Baixar a guia" aria-label={'Baixar a guia ' + ac.ROTULO_DA_GUIA[guia.tipo]}>
            <Icone nome="download" width={16} height={16} />
          </button>
          {codigo && onCopiar && (
            <button type="button" className="icon-btn" title="Copiar a linha digitável" aria-label="Copiar a linha digitável" onClick={() => onCopiar(codigo)}>
              <Icone nome="copiar" width={16} height={16} />
            </button>
          )}
        </span>
      </div>
    </li>
  );
}
