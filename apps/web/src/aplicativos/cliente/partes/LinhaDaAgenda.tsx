// Uma linha da agenda do mês na Área do Cliente (Vitor, 16/10/2026): o dia que vence, o nome da obrigação em português
// simples e a situação (feito, a fazer, não se aplica). Peça do catálogo (Listas).
import { areaCliente as ac, formatos } from '@nads/core';

const ROTULO: Record<ac.SituacaoDoItem, string> = { feito: 'Feito', 'a fazer': 'A fazer', 'nao se aplica': 'Não se aplica' };
const CLASSE: Record<ac.SituacaoDoItem, string> = { feito: 'badge-ok', 'a fazer': 'badge-warn', 'nao se aplica': 'badge-neutral' };

export function LinhaDaAgenda({ item }: { item: ac.ItemDaAgenda }) {
  const dia = item.vence.slice(8, 10);
  const mes = (formatos.MES[Number(item.vence.slice(5, 7))] || '').slice(0, 3);
  const feitoEm = item.feitoEm ? new Date(item.feitoEm).toLocaleDateString('pt-BR') : '';
  return (
    <li className={'cli-agenda cli-agenda-' + item.situacao.replace(' ', '-')}>
      <span className="cli-agenda-dia" aria-hidden="true"><b>{dia}</b><small>{mes}</small></span>
      <span className="cli-agenda-nome">
        <b>{item.nome}</b>
        <span className="hint">
          {item.situacao === 'nao se aplica' ? 'Não precisa fazer neste mês' : 'Vence em ' + ac.dataBR(item.vence)}
          {item.situacao === 'feito' && feitoEm ? ' · feito em ' + feitoEm : ''}
        </span>
      </span>
      <span className={'badge ' + CLASSE[item.situacao]}>{ROTULO[item.situacao]}</span>
    </li>
  );
}
