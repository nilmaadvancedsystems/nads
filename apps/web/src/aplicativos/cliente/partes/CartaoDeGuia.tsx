// O cartão de uma guia na Área do Cliente (Vitor, 16/10/2026): o tipo, a situação (a vencer, vence hoje, vencida), o valor
// em destaque, a competência e o vencimento, e o botão de baixar o PDF. Peça do catálogo (Cartões).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';

const CLASSE_DA_SITUACAO: Record<ac.SituacaoDaGuia, string> = { 'a vencer': 'badge-neutral', 'vence hoje': 'badge-warn', vencida: 'badge-bad' };

export function CartaoDeGuia({ guia, ocupado, onBaixar }: { guia: ac.GuiaDoCliente; ocupado?: boolean; onBaixar: (id: string) => void }) {
  return (
    <article className={'cli-guia cli-guia-' + guia.situacao.replace(' ', '-')}>
      <div className="cli-guia-topo">
        <h4>{ac.ROTULO_DA_GUIA[guia.tipo]}</h4>
        <span className={'badge ' + CLASSE_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>
      </div>
      <p className="cli-guia-valor num">{formatos.reais(guia.valor)}</p>
      <p className="hint">Vence em <b>{guia.vencimento}</b> · referente a {formatos.rot(guia.competencia)}</p>
      {guia.numero && <p className="hint">Número: <span className="num">{guia.numero}</span></p>}
      <div className="cli-guia-pe">
        <button type="button" className="btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}>
          <Icone nome="download" width={16} height={16} />{ocupado ? 'Baixando…' : 'Baixar guia'}
        </button>
      </div>
    </article>
  );
}
