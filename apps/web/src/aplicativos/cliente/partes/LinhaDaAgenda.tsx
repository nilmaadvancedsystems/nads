// Uma linha da agenda do mês na Área do Cliente (Vitor, 16/10/2026): o dia que vence, o nome da obrigação em português
// simples e a situação no selo do nads (Feito verde, A fazer amarelo, Não se aplica cinza e a linha apagada). Peça do
// catálogo (Listas).
import { areaCliente as ac } from '@nads/core';

const ROTULO: Record<ac.SituacaoDoItem, string> = { feito: 'Feito', 'a fazer': 'A fazer', 'nao se aplica': 'Não se aplica' };
const SELO: Record<ac.SituacaoDoItem, string> = { feito: 'badge badge-ok', 'a fazer': 'badge badge-warn', 'nao se aplica': 'badge badge-neutral' };

export function LinhaDaAgenda({ item }: { item: ac.ItemDaAgenda }) {
  const feitoEm = item.feitoEm ? new Date(item.feitoEm).toLocaleDateString('pt-BR') : '';
  return (
    <li className={'cli-linha' + (item.situacao === 'nao se aplica' ? ' cli-linha-apagada' : '')}>
      <span className="cli-data">{item.vence.slice(8, 10)}/{item.vence.slice(5, 7)}</span>
      <div className="cli-linha-txt">
        <b>{item.nome}</b>
        <p className="hint">
          {item.situacao === 'nao se aplica' ? 'Não precisa fazer neste mês' : 'Vence em ' + ac.dataBR(item.vence)}
          {item.situacao === 'feito' && feitoEm ? ' · feito em ' + feitoEm : ''}
        </p>
      </div>
      <span className={SELO[item.situacao]}>{ROTULO[item.situacao]}</span>
    </li>
  );
}
