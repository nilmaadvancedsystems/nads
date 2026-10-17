// Uma linha do "O que o escritório entrega no mês" na Área do Cliente (Vitor, 16/10/2026): a data, a obrigação em
// português simples e a situação no selo suave (Feito verde, A fazer neutro). Peça do catálogo (Listas).
import type { areaCliente as ac } from '@nads/core';

const ROTULO: Record<ac.SituacaoDoItem, string> = { feito: 'Feito', 'a fazer': 'A fazer', 'nao se aplica': 'Não se aplica' };
const SELO: Record<ac.SituacaoDoItem, string> = { feito: 'cli-selo bom', 'a fazer': 'cli-selo', 'nao se aplica': 'cli-selo' };

export function LinhaDaAgenda({ item }: { item: ac.ItemDaAgenda }) {
  return (
    <li className="cli-linha cli-linha-agenda">
      <span className="cli-data">{item.vence.slice(8, 10)}/{item.vence.slice(5, 7)}</span>
      <div className="cli-linha-txt">{item.nome}</div>
      <span className={SELO[item.situacao]}>{ROTULO[item.situacao]}</span>
    </li>
  );
}
