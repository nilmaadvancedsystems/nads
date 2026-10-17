// Uma linha da agenda do mês na Área do Cliente (Vitor, 16/10/2026). Versão D: a data numa folhinha (o dia e o mês), a
// obrigação em português simples e a situação: só o A fazer leva selo (amarelo); Feito fica discreto com o ✓ verde; Não se
// aplica com a linha apagada. Na Visão geral (semSituacao), só as que faltam: a data e o nome, sem selo (todas são A fazer).
// Peça do catálogo (Listas).
import type { areaCliente as ac } from '@nads/core';
import { Icone } from '@nads/ui';

const ROTULO: Record<ac.SituacaoDoItem, string> = { feito: 'Feito', 'a fazer': 'A fazer', 'nao se aplica': 'Não se aplica' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function LinhaDaAgenda({ item, semSituacao }: { item: ac.ItemDaAgenda; /** sem o selo (a lista só tem as A fazer) */ semSituacao?: boolean }) {
  return (
    <li className={'cli-linha cli-agenda-' + item.situacao.replace(/ /g, '-')}>
      <span className="cli-data" aria-label={item.vence.slice(8, 10) + '/' + item.vence.slice(5, 7)}>
        <b>{item.vence.slice(8, 10)}</b><small>{MESES[Number(item.vence.slice(5, 7)) - 1]}</small>
      </span>
      <div className="cli-linha-txt">{item.nome}</div>
      {semSituacao ? null : item.situacao === 'a fazer' ? <span className="badge badge-warn">{ROTULO[item.situacao]}</span>
        : <span className="cli-feito">{item.situacao === 'feito' && <Icone nome="check" width={14} height={14} />}{ROTULO[item.situacao]}</span>}
    </li>
  );
}
