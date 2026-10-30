// As peças do Relatório (Fiscal › Relatório e Particularidades), vindas do Controle de tributos (27/10/2026: a folha do
// Protocolo de Entrega de Tributos; 28/10/2026: "remove a tela de controle de tributos, e pegue os dados de lá e coloque
// na tela nova"): o campo de valor, a conferência (a peça do catálogo) e a entrega. As Observações e a Retificação saíram
// por enquanto (28/10/2026: "remove isso por enquanto, irei pensar melhor como podemos implementar").
import { tarefas as t } from '@nads/core';
import { Icone } from '@nads/ui';

/** O campo de valor da tabela: escreve à vontade e guarda ao sair (Enter também sai) */
/** estreito: o campo ocupa a célula da tabela do relatório, sem caixa em volta (29/10/2026: a tabela cabe na tela) */
export function Valor({ valor, sugestao, rotulo, pode, aoSalvar, largo, estreito }: { valor: string; sugestao?: string; rotulo: string; pode: boolean; aoSalvar: (v: string) => void; largo?: boolean; estreito?: boolean }) {
  return (
    <input key={valor} type="text" className={'fin-valor-edita' + (largo ? '' : ' num') + (estreito ? ' rel-campo' : '')} defaultValue={valor} placeholder={sugestao || ''} aria-label={rotulo}
      title={sugestao && !valor ? 'Do Entregas: ' + sugestao : undefined} readOnly={!pode}
      onBlur={e => { if (e.target.value !== valor) aoSalvar(e.target.value); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { e.currentTarget.value = valor; e.currentTarget.blur(); } }} />
  );
}

/** A conferência: em branco, OK ou não se aplica (—); clicar passa para a próxima */
export function MarcaDoControle({ marca, rotulo, pode, aoVirar }: { marca: t.MarcaDoControle | undefined; rotulo: string; pode: boolean; aoVirar: () => void }) {
  const m = marca || '';
  return (
    <button type="button" className={'ctrl-marca' + (m ? ' ctrl-marca-' + m : '')} disabled={!pode} onClick={aoVirar}
      aria-label={rotulo + ': ' + (m === 'ok' ? 'conferido' : m === 'na' ? 'não se aplica' : 'falta')} title={rotulo}>
      {m === 'ok' ? <Icone nome="check" width={14} height={14} /> : m === 'na' ? '—' : ''}
    </button>
  );
}

/** A entrega: a Seleção do catálogo (select-compact, com o triângulo); 30/10/2026: era a pessoal-select, que apagava o triângulo */
export function Entrega({ valor, pode, rotulo, aoMudar }: { valor: t.EntregaDoControle; pode: boolean; rotulo: string; aoMudar: (e: t.EntregaDoControle) => void }) {
  return (
    <select className={'select-compact ctrl-entrega' + (valor ? ' ctrl-entrega-feita' : '')} value={valor} disabled={!pode} aria-label={rotulo}
      onChange={e => aoMudar(e.target.value as t.EntregaDoControle)}>
      {t.ENTREGAS_DO_CONTROLE.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
    </select>
  );
}
