// Uma guia em linha na Visão geral da Área do Cliente (Vitor, 16/10/2026), como as "Obrigações e guias próximas" do
// protótipo, com as peças do nads: a sigla, o nome e a competência, o vencimento e o valor, o selo da situação, baixar e
// copiar a linha digitável (quando tem). Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO, siglaDaGuia } from './guia';

export function LinhaDeGuia({ guia, codigo, ocupado, onBaixar, onCopiar }: { guia: ac.GuiaDoCliente; codigo?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void }) {
  return (
    <li className="cli-linha">
      <span className="cli-sigla" aria-hidden="true">{siglaDaGuia(guia.tipo)}</span>
      <div className="cli-linha-txt">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]} · competência {guia.competencia.slice(5, 7)}/{guia.competencia.slice(0, 4)}</b>
        <p className="hint">Vence em {guia.vencimento} · <span className="cli-valor">{formatos.reais(guia.valor)}</span></p>
      </div>
      <div className="cli-linha-dir">
        <span className={SELO_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>
        <button type="button" className="icon-btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} title="Baixar a guia" aria-label={'Baixar a guia ' + ac.ROTULO_DA_GUIA[guia.tipo]}>
          <Icone nome="download" width={16} height={16} />
        </button>
        {codigo && onCopiar && (
          <button type="button" className="icon-btn" title="Copiar a linha digitável" aria-label="Copiar a linha digitável" onClick={() => onCopiar(codigo)}>
            <Icone nome="copiar" width={16} height={16} />
          </button>
        )}
      </div>
    </li>
  );
}
