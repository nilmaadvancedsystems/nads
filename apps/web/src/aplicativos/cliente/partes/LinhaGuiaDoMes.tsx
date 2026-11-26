// As linhas da lista de Guias e obrigações (13/11/2026: "refaça esses 3"; a tela de Solicitações como referência). Enxugadas
// em 16/11/2026 (o dono apresentou a área e ouviu "tinha muita informação"): a logo do órgão, o nome, UMA frase curta de
// data ("Vence 19/11", "Venceu 11/11"), o valor e UM botão (Baixar, ou Pedir nova na vencida); ver a guia, copiar o código
// e baixar a vencida ficam no menu "⋯" ao lado. Saíram a competência e o "daqui a N dias". Só a tela de Guias usa; a
// LinhaDeGuia e a LinhaDePaga continuam para a Visão geral e o catálogo. O estilo está em telas/guias.css.
// As classes cli-linha-guia e cli-g-acoes ficam por causa do tutorial (ele acende as ações pela posição: 1 o botão, 2 o ⋯).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone, MenuSuspenso, type ItemMenu } from '@nads/ui';
import type { GuiaPaga } from '../dados/areaCliente';
import { SiglaDaGuia } from './SiglaDaGuia';

export function LinhaGuiaDoMes({ guia, codigo, quando, destaque, escolhida, dia, ocupado, onVer, onBaixar, onCopiar, onPedirNova, onComprovante, comprovanteEm, onJaPaguei }: {
  /** "Já paguei: tirar da lista" (26/11/2026) */
  onJaPaguei?: (guia: ac.GuiaDoCliente) => void;
  guia: ac.GuiaDoCliente; codigo?: string; /** a frase curta (dados/guiasDoMes.quandoVence) */ quando: { texto: string; tom: '' | 'vencida' | 'hoje' }; /** o Baixar carmim (a próxima a pagar) */ destaque: boolean;
  /** o dia escolhido no calendário */ escolhida: boolean; dia: number; ocupado: boolean;
  onVer: (id: string) => void; onBaixar: (id: string) => void; onCopiar: (codigo: string) => void; onPedirNova: (guia: ac.GuiaDoCliente) => void;
  /** "Já paguei: mandar o comprovante" e o dia em que o cliente mandou ('dd/mm'; '' = ainda não) (plano do Acessórias, 17/11/2026, ficha comprovante-da-guia, parte A) */
  onComprovante?: (guia: ac.GuiaDoCliente) => void; comprovanteEm?: string;
}) {
  const nome = ac.rotuloDaGuia(guia);
  const vencida = guia.situacao === 'vencida';
  // (16/11/2026) o que não é a ação principal vai para o "⋯"; a vencida não tem o código (não passa mais no banco)
  const mais: ItemMenu[] = [
    ...(guia.temPdf ? [{ rotulo: 'Ver a guia', icone: 'olho' as const, desabilitado: ocupado, onClick: () => onVer(guia.id) }] : []),
    ...(vencida && guia.temPdf ? [{ rotulo: 'Baixar a vencida', icone: 'download' as const, desabilitado: ocupado, onClick: () => onBaixar(guia.id) }] : []),
    ...(!vencida && codigo && guia.temPdf ? [{ rotulo: 'Copiar o código de barras', icone: 'copiar' as const, onClick: () => onCopiar(codigo) }] : []),
    // (17/11/2026, ficha comprovante-da-guia) um item no "⋯", não um botão novo na linha (R10)
    ...(onJaPaguei ? [{ rotulo: 'Já paguei: tirar da lista', icone: 'check' as const, onClick: () => onJaPaguei(guia) }] : []),
    ...(onComprovante ? [{ rotulo: 'Já paguei: mandar o comprovante', icone: 'upload' as const, onClick: () => onComprovante(guia) }] : []),
  ];
  // (16/11/2026, revisão de consistência: "muita informação") sem o PDF, o botão principal vira Copiar código, como nas
  // Próximas guias da Visão geral (antes ficava um Baixar apagado e o código só no "⋯")
  const soCodigo = !vencida && !guia.temPdf && !!codigo;
  return (
    <li data-dia={dia} className={'cli-gu-linha cli-linha-guia' + (quando.tom ? ' s-' + quando.tom : '') + (escolhida ? ' escolhida' : '')}>
      <span className="cli-gu-logo"><SiglaDaGuia tipo={guia.tipo} tamanho={34} /></span>
      <span className="cli-gu-txt">
        <b className="cli-gu-nome">{nome}</b>
        <span className="cli-gu-sub"><span className={'cli-gu-junto' + (quando.tom ? ' cli-gu-sit' : '')}>{quando.texto}</span>{comprovanteEm ? <span className="cli-gu-junto"> · Comprovante enviado em {comprovanteEm}</span> : null}</span>
      </span>
      <span className="cli-gu-valor">{formatos.reais(guia.valor)}</span>
      {/* duas casas iguais em todas as linhas: o botão principal e o "⋯" */}
      <span className="cli-gu-acoes cli-g-acoes">
        {vencida ? (
          <button type="button" className="btn cli-gu-principal cli-gu-pedir" onClick={() => onPedirNova(guia)}><Icone nome="repeat" width={15} height={15} />Pedir nova</button>
        ) : soCodigo ? (
          <button type="button" className={'btn cli-gu-principal' + (destaque ? ' btn-primary' : '')} onClick={() => { if (codigo) onCopiar(codigo); }}><Icone nome="copiar" width={15} height={15} />Copiar código</button>
        ) : (
          <button type="button" className={'btn cli-gu-principal' + (destaque ? ' btn-primary' : '')} disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} aria-label={'Baixar a guia ' + nome}><Icone nome="download" width={15} height={15} />Baixar</button>
        )}
        {mais.length ? (
          <span className="cli-gu-mais">
            <MenuSuspenso rotulo="" icone="mais" className="icon-btn" semSeta direita flutuante compacto dica="Mais ações" titulo={'Mais ações: ' + nome} itens={mais} />
          </span>
        ) : <span className="cli-gu-vaga" aria-hidden="true" />}
      </span>
    </li>
  );
}

export function LinhaPagaDoMes({ paga, escolhida, dia, ocupado, onComprovante }: { paga: GuiaPaga; escolhida: boolean; dia: number; ocupado: boolean; onComprovante: (id: string) => void }) {
  return (
    <li data-dia={dia} className={'cli-gu-linha cli-linha-guia s-paga' + (escolhida ? ' escolhida' : '')}>
      <span className="cli-gu-logo">
        {paga.tipo ? <SiglaDaGuia tipo={paga.tipo} tamanho={34} /> : <span className="cli-sigla pago" style={{ width: 34, height: 34 }} aria-hidden="true"><Icone nome="check" width={16} height={16} /></span>}
      </span>
      <span className="cli-gu-txt">
        <b className="cli-gu-nome">{paga.nome}</b>
        {/* (16/11/2026, "muita informação") só a data do pagamento, sem a competência */}
        <span className="cli-gu-sub"><span className="cli-gu-junto">Paga em {paga.pagoEm.slice(0, 5)}</span></span>
      </span>
      <span className="cli-gu-valor">{formatos.reais(paga.valor)}</span>
      <span className="cli-gu-acoes cli-g-acoes">
        {paga.temComprovante ? (
          <button type="button" className="btn cli-gu-principal" disabled={ocupado} onClick={() => onComprovante(paga.id)} aria-label={'Baixar o comprovante de ' + paga.nome}><Icone nome="fileDown" width={15} height={15} />Comprovante</button>
        ) : <span className="cli-gu-vaga" aria-hidden="true" />}
        <span className="cli-gu-vaga" aria-hidden="true" />
      </span>
    </li>
  );
}
