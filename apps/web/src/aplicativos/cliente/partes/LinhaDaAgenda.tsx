// Uma linha da agenda do mês na Área do Cliente (Vitor, 16/10/2026): a data, a obrigação em português simples e a
// situação escrita, sem selo (Feito, A fazer; Não se aplica com a linha apagada). Peça do catálogo (Listas).
import type { areaCliente as ac } from '@nads/core';

const ROTULO: Record<ac.SituacaoDoItem, string> = { feito: 'Feito', 'a fazer': 'A fazer', 'nao se aplica': 'Não se aplica' };

export function LinhaDaAgenda({ item }: { item: ac.ItemDaAgenda }) {
  return (
    <li className={'cli-linha cli-agenda-' + item.situacao.replace(/ /g, '-')}>
      <span className="cli-data">{item.vence.slice(8, 10)}/{item.vence.slice(5, 7)}</span>
      <div className="cli-linha-txt">{item.nome}</div>
      <span className="cli-situacao">{ROTULO[item.situacao]}</span>
    </li>
  );
}
