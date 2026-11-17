// Uma guia em linha na Visão geral da Área do Cliente (Vitor, 16 e 17/10/2026: "quero que melhore esse layout"), como as
// "Obrigações e guias próximas" do protótipo, com as peças do nads. Versão D: uma grade de colunas fixas, igual em todas as
// linhas — a logo do órgão (40 px, sem fundo), o nome com a competência e o vencimento, o selo da situação (largura fixa,
// alinhado à esquerda), o valor (largura fixa, à direita, tabular) e as ações (largura fixa, alinhadas à direita), para os
// selos e os valores ficarem em fila. Peça do catálogo (Listas).
// "Melhora mais" de 17/10/2026 (o assistente de pagamento dos portais, como o do Omie): a ação principal com nome — "Baixar"
// (carmim só na guia em destaque) com o copiar o código ao lado; na vencida, "Pedir nova" (a guia vencida não passa no
// banco), com o PDF antigo ainda à mão no ícone.
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SELO_DA_SITUACAO } from './guia';
import { SiglaDaGuia } from './SiglaDaGuia';

export function LinhaDeGuia({ guia, codigo, faltam, destaque, ocupado, onBaixar, onCopiar, onPedirNova, onVer }: {
  guia: ac.GuiaDoCliente; codigo?: string; /** "em 3 dias", "há 5 dias" */ faltam?: string;
  /** o Baixar em carmim (um só por área: a próxima a pagar) */ destaque?: boolean; ocupado?: boolean; onBaixar: (id: string) => void; onCopiar?: (codigo: string) => void;
  /** na vencida, o "Pedir nova" (abre o chamado já com o assunto); sem ele, a vencida também mostra o Baixar */ onPedirNova?: (guia: ac.GuiaDoCliente) => void;
  /** a pré-visualização (12/11/2026): o olho abre a guia numa janela, sem baixar */ onVer?: (id: string) => void;
}) {
  const pedirNova = guia.situacao === 'vencida' && !!onPedirNova;
  return (
    <li className={'cli-linha cli-linha-guia' + (guia.situacao === 'vencida' ? ' cli-g-vencida' : '')}>
      <span className="cli-g-logo"><SiglaDaGuia tipo={guia.tipo} tamanho={40} /></span>
      <div className="cli-g-txt">
        <b>{ac.ROTULO_DA_GUIA[guia.tipo]}</b>
        <p className="hint" title={'Competência ' + guia.competencia.slice(5, 7) + '/' + guia.competencia.slice(0, 4) + ' · vencimento ' + guia.vencimento}>
          {/* cada pedaço inteiro numa linha: no celular quebra entre eles, nunca no meio da data */}
          <span className="cli-junto">{guia.situacao === 'vencida' ? 'Venceu' : 'Vence'} em {guia.vencimento.slice(0, 5)}{faltam ? ' (' + faltam + ')' : ''}</span>
          <span className="cli-junto cli-g-comp">competência {guia.competencia.slice(5, 7)}/{guia.competencia.slice(0, 4)}</span>
        </p>
      </div>
      <span className="cli-g-selo"><span className={SELO_DA_SITUACAO[guia.situacao]}>{ac.ROTULO_DA_SITUACAO_DA_GUIA[guia.situacao]}</span></span>
      <span className="cli-g-valor cli-valor">{formatos.reais(guia.valor)}</span>
      {/* as ações em três casas fixas (12/11/2026), para ficarem em coluna em todas as linhas: ver · a secundária · a principal */}
      <span className="cli-g-acoes">
        {onVer && guia.temPdf ? (
          <button type="button" className="icon-btn" disabled={ocupado} onClick={() => onVer(guia.id)} title="Ver a guia" aria-label={'Ver a guia ' + ac.ROTULO_DA_GUIA[guia.tipo]}>
            <Icone nome="olho" width={16} height={16} />
          </button>
        ) : <span className="cli-g-vaga" aria-hidden="true" />}
        {pedirNova ? (
          <button type="button" className="icon-btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} title="Baixar a guia vencida" aria-label={'Baixar a guia vencida ' + ac.ROTULO_DA_GUIA[guia.tipo]}>
            <Icone nome="download" width={16} height={16} />
          </button>
        ) : codigo && onCopiar ? (
          <button type="button" className="icon-btn" title="Copiar o código de barras" aria-label="Copiar o código de barras" onClick={() => onCopiar(codigo)}>
            <Icone nome="copiar" width={16} height={16} />
          </button>
        ) : <span className="cli-g-vaga" aria-hidden="true" />}
        {pedirNova ? (
          <button type="button" className="btn cli-pedir-nova" onClick={() => onPedirNova?.(guia)}><Icone nome="repeat" width={16} height={16} />Pedir nova</button>
        ) : (
          <button type="button" className={'btn' + (destaque ? ' btn-primary' : '')} disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} aria-label={'Baixar a guia ' + ac.ROTULO_DA_GUIA[guia.tipo]}>
            <Icone nome="download" width={16} height={16} />Baixar
          </button>
        )}
      </span>
    </li>
  );
}
