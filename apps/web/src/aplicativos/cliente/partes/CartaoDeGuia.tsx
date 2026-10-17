// O cartão de uma guia na Área do Cliente (Vitor, 16/10/2026), no estilo do nads: o card com o nome e o selo (vencida ou
// vence hoje; a borda acompanha), o valor, o vencimento, a competência e o número, e embaixo baixar a guia e copiar a
// linha digitável (quando tem). Peça do catálogo (Cartões).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO } from './guia';

export function CartaoDeGuia({ guia, codigo, ocupado, onBaixar, onCopiar }: { guia: ac.GuiaDoCliente; codigo?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void }) {
  const selo = SELO_DA_SITUACAO[guia.situacao];
  return (
    <article className={'card cli-guia cli-guia-' + guia.situacao.replace(' ', '-')}>
      <div className="cli-guia-topo">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]}</b>
        {selo && <span className={selo}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>}
      </div>
      <p className="stat-value">{formatos.reais(guia.valor)}</p>
      <div>
        <p className="hint">Vence em {guia.vencimento}</p>
        <p className="hint">Referente a {formatos.rot(guia.competencia)}</p>
        {guia.numero && <p className="hint">Número <span className="num">{guia.numero}</span></p>}
      </div>
      <div className="cli-guia-pe">
        <button type="button" className="btn btn-primary" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}>
          <Icone nome="download" width={16} height={16} />{ocupado ? 'Baixando…' : guia.temPdf ? 'Baixar guia' : 'Ainda sem arquivo'}
        </button>
        {codigo && onCopiar && <button type="button" className="btn" onClick={() => onCopiar(codigo)}><Icone nome="copiar" width={16} height={16} />Copiar código</button>}
      </div>
    </article>
  );
}
