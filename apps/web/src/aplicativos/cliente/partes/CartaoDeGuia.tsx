// O cartão de uma guia em Guias e obrigações da Área do Cliente (Vitor, 16/10/2026), como os "Próximos vencimentos" do
// protótipo, no card do nads: a sigla no selo e o valor no alto, o nome, o vencimento (com quantos dias faltam) e, embaixo
// do fio, Baixar PDF e copiar a linha digitável (quando tem). Peça do catálogo (Cartões).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO, siglaDaGuia } from './guia';

export function CartaoDeGuia({ guia, codigo, faltam, ocupado, onBaixar, onCopiar }: {
  guia: ac.GuiaDoCliente; codigo?: string; /** o texto de quanto falta, ex.: "em 4 dias" */ faltam?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void;
}) {
  return (
    <article className="card cli-cartao">
      <div className="cli-cartao-topo">
        <span className={SELO_DA_SITUACAO[guia.situacao]}>{siglaDaGuia(guia.tipo)}</span>
        <b className="cli-valor">{formatos.reais(guia.valor)}</b>
      </div>
      <p className="cli-cartao-nome">{ac.ROTULO_DA_GUIA[guia.tipo]} · competência {guia.competencia.slice(5, 7)}/{guia.competencia.slice(0, 4)}</p>
      <p className="hint">{guia.situacao === 'vencida' ? 'Venceu em ' : 'Vence em '}<b>{guia.vencimento}</b>{faltam ? ' (' + faltam + ')' : ''}</p>
      <div className="cli-cartao-pe">
        <button type="button" className="btn btn-primary" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}>{ocupado ? 'Baixando…' : 'Baixar PDF'}</button>
        {codigo && onCopiar && (
          <button type="button" className="icon-btn" title="Copiar a linha digitável" aria-label="Copiar a linha digitável" onClick={() => onCopiar(codigo)}>
            <Icone nome="copiar" width={16} height={16} />
          </button>
        )}
      </div>
    </article>
  );
}
