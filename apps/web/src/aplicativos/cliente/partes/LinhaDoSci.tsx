// Uma guia do SCI Report na aba Guias e obrigações (24/11/2026), no desenho das linhas da aba (LinhaGuiaDoMes, enxugada
// em 16/11/2026 com "muita informação"): a sigla, o nome, UMA frase curta de data, o valor e UM botão (Ver, que pede o PDF
// à função), com a mesma casa vazia no lugar do "⋯". "Pagamento informado" é o que o cliente registrou no SCI Report, não a
// confirmação do banco: a frase diz isso ("Pagamento informado em 19/11"). O estilo é o de telas/guias.css.
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import { SiglaDaGuia } from './SiglaDaGuia';

/** a frase curta e o tom da linha (os mesmos s-vencida, s-hoje e s-paga da LinhaGuiaDoMes) */
function quandoDoSci(g: ac.GuiaDoSciReport): { texto: string; tom: '' | 'vencida' | 'hoje' | 'paga' } {
  if (g.situacao === 'pagamento informado') return { texto: 'Pagamento informado' + (g.pagamentoEm ? ' em ' + g.pagamentoEm.slice(0, 5) : ''), tom: 'paga' };
  if (g.situacao === 'vencida') return { texto: 'Venceu ' + g.vencimento.slice(0, 5), tom: 'vencida' };
  if (g.situacao === 'vence hoje') return { texto: 'Vence hoje', tom: 'hoje' };
  return { texto: 'Vence ' + g.vencimento.slice(0, 5), tom: '' };
}

export function LinhaDoSci({ guia, ocupado, onAbrir }: { guia: ac.GuiaDoSciReport; ocupado?: boolean; onAbrir: (id: string) => void }) {
  const quando = quandoDoSci(guia);
  return (
    <li className={'cli-gu-linha' + (quando.tom ? ' s-' + quando.tom : '')}>
      <span className="cli-gu-logo"><SiglaDaGuia tipo="outra" tamanho={34} /></span>
      <span className="cli-gu-txt">
        <b className="cli-gu-nome">{guia.nome}</b>
        <span className="cli-gu-sub"><span className={'cli-gu-junto' + (quando.tom === 'vencida' || quando.tom === 'hoje' ? ' cli-gu-sit' : '')}>{quando.texto}</span></span>
      </span>
      <span className="cli-gu-valor">{formatos.reais(guia.valorPago ?? guia.valor)}</span>
      <span className="cli-gu-acoes cli-g-acoes">
        <button type="button" className="btn cli-gu-principal" disabled={ocupado} onClick={() => onAbrir(guia.id)} aria-label={'Ver a guia ' + guia.nome}>
          <Icone nome="olho" width={15} height={15} />Ver
        </button>
        <span className="cli-gu-vaga" aria-hidden="true" />
      </span>
    </li>
  );
}
