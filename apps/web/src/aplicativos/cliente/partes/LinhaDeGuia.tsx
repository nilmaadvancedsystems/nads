// Uma guia em linha no Início da Área do Cliente (Vitor, 16/10/2026), como as "Obrigações e Guias Próximas" do protótipo:
// a sigla num quadradinho, o nome e a competência, o vencimento e o valor, o selo da situação e o botão de baixar. A linha
// fica amarelada quando vence hoje e avermelhada quando venceu. Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { CLASSE_DA_SITUACAO, siglaDaGuia } from './guia';

export function LinhaDeGuia({ guia, ocupado, onBaixar }: { guia: ac.GuiaDoCliente; ocupado?: boolean; onBaixar: (id: string) => void }) {
  return (
    <li className={'cli-lguia cli-lguia-' + guia.situacao.replace(' ', '-')}>
      <div className="cli-lguia-esq">
        <span className="cli-sigla" aria-hidden="true">{siglaDaGuia(guia.tipo)}</span>
        <div className="cli-lguia-txt">
          <h3>{ac.ROTULO_DA_GUIA[guia.tipo]} · referente a {formatos.rot(guia.competencia)}</h3>
          <p className="cli-meta">
            <span><Icone nome="calendar" width={13} height={13} />Vence em <b>{guia.vencimento}</b></span>
            <span className="cli-sep" aria-hidden="true">•</span>
            <span className="num">{formatos.reais(guia.valor)}</span>
          </p>
        </div>
      </div>
      <div className="cli-lguia-dir">
        <span className={'cli-selo ' + CLASSE_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>
        <button type="button" className="cli-icone-btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}
          aria-label={'Baixar a guia ' + ac.ROTULO_DA_GUIA[guia.tipo]} title={guia.temPdf ? 'Baixar a guia' : 'O arquivo ainda não está aqui'}>
          <Icone nome="download" width={16} height={16} />
        </button>
      </div>
    </li>
  );
}
