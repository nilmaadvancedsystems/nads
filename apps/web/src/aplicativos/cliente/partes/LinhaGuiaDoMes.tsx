// As linhas da lista de Guias e obrigações (13/11/2026: "refaça esses 3"; a tela de Solicitações como referência): a logo
// do órgão, o nome, uma linha secundária com a situação em cor (só a palavra), o vencimento e a competência, o valor
// sempre no mesmo ponto e as ações em três casas fixas (ver · baixar ou copiar o código · a principal). Só a tela de Guias
// usa; a LinhaDeGuia e a LinhaDePaga continuam para a Visão geral e o catálogo. O estilo está em telas/guias.css.
// As classes cli-linha-guia e cli-g-acoes ficam por causa do tutorial (ele acende as ações pela posição).
import { areaCliente as ac, formatos } from '@nads/core';
import { Icone } from '@nads/ui';
import type { GuiaPaga } from '../dados/areaCliente';
import { SiglaDaGuia } from './SiglaDaGuia';

const comp = (c: string) => c.slice(5, 7) + '/' + c.slice(0, 4);

export function LinhaGuiaDoMes({ guia, codigo, quando, destaque, escolhida, dia, ocupado, onVer, onBaixar, onCopiar, onPedirNova }: {
  guia: ac.GuiaDoCliente; codigo?: string; /** a linha menor (regras.vencimentoDaGuia) */ quando: { palavra: string; texto: string }; /** o Baixar carmim (a próxima a pagar) */ destaque: boolean;
  /** o dia escolhido no calendário */ escolhida: boolean; dia: number; ocupado: boolean;
  onVer: (id: string) => void; onBaixar: (id: string) => void; onCopiar: (codigo: string) => void; onPedirNova: (guia: ac.GuiaDoCliente) => void;
}) {
  const nome = ac.ROTULO_DA_GUIA[guia.tipo];
  const vencida = guia.situacao === 'vencida', hoje = guia.situacao === 'vence hoje';
  return (
    <li data-dia={dia} className={'cli-gu-linha cli-linha-guia' + (vencida ? ' s-vencida' : hoje ? ' s-hoje' : '') + (escolhida ? ' escolhida' : '')}>
      <span className="cli-gu-logo"><SiglaDaGuia tipo={guia.tipo} tamanho={34} /></span>
      <span className="cli-gu-txt">
        <b className="cli-gu-nome">{nome}</b>
        {/* (13/11/2026, revisão) sem o "A pagar" repetido em toda linha: a palavra em cor só na vencida e na de hoje */}
        <span className="cli-gu-sub">
          <span className="cli-gu-junto">{quando.palavra && <span className="cli-gu-sit">{quando.palavra}</span>}{quando.palavra && quando.texto ? ' ' : ''}{quando.texto}</span>
          <span className="cli-gu-sep-comp" aria-hidden="true">·</span><span className="cli-gu-junto cli-gu-comp">competência {comp(guia.competencia)}</span>
        </span>
      </span>
      <span className="cli-gu-valor">{formatos.reais(guia.valor)}</span>
      {/* as três casas (13/11/2026: iguais em todas as linhas): ver · baixar a vencida ou copiar o código · Baixar ou Pedir nova */}
      <span className="cli-gu-acoes cli-g-acoes">
        {guia.temPdf ? (
          <button type="button" className="icon-btn" disabled={ocupado} onClick={() => onVer(guia.id)} title="Ver a guia" aria-label={'Ver a guia ' + nome}><Icone nome="olho" width={16} height={16} /></button>
        ) : <span className="cli-gu-vaga" aria-hidden="true" />}
        {vencida ? (
          <button type="button" className="icon-btn" disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} title="Baixar a guia vencida" aria-label={'Baixar a guia vencida ' + nome}><Icone nome="download" width={16} height={16} /></button>
        ) : codigo ? (
          <button type="button" className="icon-btn" onClick={() => onCopiar(codigo)} title="Copiar o código de barras" aria-label={'Copiar o código de barras ' + nome}><Icone nome="copiar" width={16} height={16} /></button>
        ) : <span className="cli-gu-vaga" aria-hidden="true" />}
        {vencida ? (
          <button type="button" className="btn cli-gu-principal cli-gu-pedir" onClick={() => onPedirNova(guia)}><Icone nome="repeat" width={15} height={15} />Pedir nova</button>
        ) : (
          <button type="button" className={'btn cli-gu-principal' + (destaque ? ' btn-primary' : '')} disabled={!guia.temPdf || ocupado} onClick={() => onBaixar(guia.id)} aria-label={'Baixar a guia ' + nome}><Icone nome="download" width={15} height={15} />Baixar</button>
        )}
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
        <span className="cli-gu-sub">
          {/* (13/11/2026, revisão) na aba Pagas, o "Paga" verde em toda linha era repetição: só a data */}
          <span className="cli-gu-junto">Paga em {paga.pagoEm.slice(0, 5)}</span>
          {paga.competencia && <><span className="cli-gu-sep-comp" aria-hidden="true">·</span><span className="cli-gu-junto cli-gu-comp">competência {comp(paga.competencia)}</span></>}
        </span>
      </span>
      <span className="cli-gu-valor">{formatos.reais(paga.valor)}</span>
      <span className="cli-gu-acoes cli-g-acoes">
        <span className="cli-gu-vaga" aria-hidden="true" />
        <span className="cli-gu-vaga" aria-hidden="true" />
        {paga.temComprovante ? (
          <button type="button" className="btn cli-gu-principal" disabled={ocupado} onClick={() => onComprovante(paga.id)} aria-label={'Baixar o comprovante de ' + paga.nome}><Icone nome="fileDown" width={15} height={15} />Comprovante</button>
        ) : <span className="cli-gu-vaga" aria-hidden="true" />}
      </span>
    </li>
  );
}
