// O cartão de uma guia na Área do Cliente (Vitor, 16/10/2026), no visual do protótipo do Vitor: cartão arredondado com a
// etiqueta do tipo e o selo da situação (a vencer, vence hoje, vencida — a borda também muda), o valor em destaque, o nome,
// o vencimento e a competência, e embaixo o botão de degradê para baixar o PDF. Peça do catálogo (Cartões).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { CLASSE_DA_SITUACAO, siglaDaGuia } from './guia';

export function CartaoDeGuia({ guia, ocupado, onBaixar }: { guia: ac.GuiaDoCliente; ocupado?: boolean; onBaixar: (id: string) => void }) {
  return (
    <article className={'cli-guia cli-guia-' + guia.situacao.replace(' ', '-')}>
      <div className="cli-guia-topo">
        <span className="cli-etiqueta">{siglaDaGuia(guia.tipo)}</span>
        <span className={'cli-selo ' + CLASSE_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>
      </div>
      <div>
        <p className="cli-guia-valor">{formatos.reais(guia.valor)}</p>
        <h3>{ac.ROTULO_DA_GUIA[guia.tipo]}</h3>
      </div>
      <div>
        <p className="cli-meta"><span><Icone nome="clock" width={13} height={13} />Vence em <b>{guia.vencimento}</b></span></p>
        <p className="cli-meta">Referente a {formatos.rot(guia.competencia)}</p>
        {guia.numero && <p className="cli-meta">Número: <span className="num">{guia.numero}</span></p>}
      </div>
      <div className="cli-guia-pe">
        <button type="button" className="cli-btn cli-btn-marca" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}>
          <Icone nome="download" width={16} height={16} />{ocupado ? 'Baixando…' : guia.temPdf ? 'Baixar guia' : 'Guia ainda sem arquivo'}
        </button>
      </div>
    </article>
  );
}
