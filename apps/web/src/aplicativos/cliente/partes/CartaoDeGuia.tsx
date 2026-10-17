// O cartão de uma guia em Guias e obrigações da Área do Cliente (Vitor, 16/10/2026), como os "Próximos vencimentos" do
// protótipo, compacto no card do nads: na primeira linha a sigla, o nome e o valor; na segunda o vencimento (o "há N dias"
// em cor de atenção quando venceu) e, à direita, copiar a linha digitável e Baixar PDF (secundário). Peça do catálogo
// (Cartões).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { siglaDaGuia, TOM_DA_SIGLA } from './guia';

export function CartaoDeGuia({ guia, codigo, faltam, ocupado, onBaixar, onCopiar }: {
  guia: ac.GuiaDoCliente; codigo?: string; /** o texto de quanto falta, ex.: "em 4 dias" */ faltam?: string; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void;
}) {
  const vencida = guia.situacao === 'vencida';
  return (
    <article className="card cli-cartao">
      <div className="cli-cartao-l1">
        <span className={TOM_DA_SIGLA[guia.situacao]} aria-hidden="true">{siglaDaGuia(guia.tipo)}</span>
        <b className="cli-cartao-nome">{ac.ROTULO_DA_GUIA[guia.tipo]}</b>
        <b className="cli-valor">{formatos.reais(guia.valor)}</b>
      </div>
      <div className="cli-cartao-l2">
        <span className="hint">
          {guia.situacao === 'vence hoje' ? <span className="cli-atencao">Vence hoje</span> : <>{vencida ? 'Venceu em ' : 'Vence em '}{guia.vencimento.slice(0, 5)}</>}
          {faltam && <span className={vencida ? ' cli-ruim' : ''}> ({faltam})</span>}
        </span>
        <span className="cli-acoes-linha">
          {codigo && onCopiar && (
            <button type="button" className="icon-btn" title="Copiar a linha digitável" aria-label="Copiar a linha digitável" onClick={() => onCopiar(codigo)}>
              <Icone nome="copiar" width={16} height={16} />
            </button>
          )}
          <button type="button" className="btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}>
            <Icone nome="download" width={16} height={16} />{ocupado ? 'Baixando…' : 'Baixar PDF'}
          </button>
        </span>
      </div>
    </article>
  );
}
