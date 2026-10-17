// O cartão de uma guia em Guias e obrigações da Área do Cliente (Vitor, 16/10/2026), como os "Próximos vencimentos" do
// protótipo, no card do nads. Versão D: a logo do órgão (ou a sigla) e o selo da situação no alto, o valor grande em número tabular, o nome, o
// vencimento (com quantos dias faltam) e, embaixo do fio, Baixar PDF e copiar a linha digitável (quando tem). Só a guia
// em destaque (a mais urgente) leva o botão carmim; as outras, o secundário. Peça do catálogo (Cartões).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO } from './guia';
import { SiglaDaGuia } from './SiglaDaGuia';

export function CartaoDeGuia({ guia, codigo, faltam, ocupado, destaque = true, onBaixar, onCopiar }: {
  guia: ac.GuiaDoCliente; codigo?: string; /** o texto de quanto falta, ex.: "em 4 dias" */ faltam?: string; ocupado?: boolean;
  /** o botão carmim (um só por área: a guia mais urgente) */ destaque?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void;
}) {
  return (
    <article className="card cli-cartao">
      <div className="cli-cartao-topo">
        <SiglaDaGuia tipo={guia.tipo} tamanho={40} />
        <span className={SELO_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span>
      </div>
      <p className="cli-cartao-valor">{formatos.reais(guia.valor)}</p>
      <p className="cli-cartao-nome">{ac.ROTULO_DA_GUIA[guia.tipo]}</p>
      <p className="hint">Competência {guia.competencia.slice(5, 7)}/{guia.competencia.slice(0, 4)}</p>
      <p className="hint">{guia.situacao === 'vencida' ? 'Venceu em ' : 'Vence em '}{guia.vencimento}{faltam ? ' · ' + faltam : ''}</p>
      <div className="cli-cartao-pe">
        <button type="button" className={'btn' + (destaque ? ' btn-primary' : '')} disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)}>
          <Icone nome="download" width={16} height={16} />{ocupado ? 'Baixando…' : 'Baixar PDF'}
        </button>
        {codigo && onCopiar && (
          <button type="button" className="icon-btn" title="Copiar a linha digitável" aria-label="Copiar a linha digitável" onClick={() => onCopiar(codigo)}>
            <Icone nome="copiar" width={16} height={16} />
          </button>
        )}
      </div>
    </article>
  );
}
