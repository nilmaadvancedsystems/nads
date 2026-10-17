// Uma guia em linha na Visão geral da Área do Cliente (Vitor, 16/10/2026), como as "Obrigações e guias próximas" do
// protótipo, com as peças do nads: a sigla, o nome e o vencimento, o valor na coluna dele (alinhado), o selo suave da
// situação e os botões de ícone de baixar e copiar a linha digitável (quando tem). Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO, siglaDaGuia } from './guia';

export function LinhaDeGuia({ guia, codigo, ocupado, onBaixar, onCopiar }: { guia: ac.GuiaDoCliente; codigo?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void }) {
  return (
    <li className="cli-linha cli-linha-guia">
      <span className="cli-sigla" aria-hidden="true">{siglaDaGuia(guia.tipo)}</span>
      <div className="cli-linha-txt">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]}</b>
        <p className="hint">Vence em {guia.vencimento} · competência {guia.competencia.slice(5, 7)}/{guia.competencia.slice(0, 4)}</p>
      </div>
      <span className="cli-valor">{formatos.reais(guia.valor)}</span>
      <span className="cli-coluna-selo"><span className={SELO_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span></span>
      <span className="cli-acoes-linha">
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
