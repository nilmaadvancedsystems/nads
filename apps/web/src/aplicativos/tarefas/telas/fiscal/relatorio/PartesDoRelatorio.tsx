// As peças do Relatório (Fiscal › Relatório e Particularidades), vindas do Controle de tributos (27/10/2026: a folha do
// Protocolo de Entrega de Tributos; 28/10/2026: "remove a tela de controle de tributos, e pegue os dados de lá e coloque
// na tela nova"): o campo de valor, a conferência (a peça do catálogo) e a entrega. As Observações e a Retificação saíram
// por enquanto (28/10/2026: "remove isso por enquanto, irei pensar melhor como podemos implementar").
import { tarefas as t } from '@nads/core';
import { Icone, LogoGmail, LogoWhatsApp, MenuSuspenso } from '@nads/ui';

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

/** O sinal da entrega no lugar do nome (30/10/2026: "coloque o símbolo do Gmail, WhatsApp ao invés dos nomes") */
function SinalDaEntrega({ valor }: { valor: t.EntregaDoControle }) {
  if (valor === 'zap') return <span className="ctrl-entrega-sinal"><LogoWhatsApp /></span>;
  if (valor === 'email') return <span className="ctrl-entrega-sinal"><LogoGmail /></span>;
  if (valor === 'impresso') return <span className="ctrl-entrega-sinal"><Icone nome="printer" width={16} height={16} /></span>;
  return <span className="ctrl-entrega-texto">{valor === 'nao' ? '—' : 'Falta'}</span>;
}

/** A entrega: o Menu suspenso do catálogo (o select não mostra os logos), flutuante porque a tabela rola */
export function Entrega({ valor, pode, rotulo, aoMudar }: { valor: t.EntregaDoControle; pode: boolean; rotulo: string; aoMudar: (e: t.EntregaDoControle) => void }) {
  const nome = t.ENTREGAS_DO_CONTROLE.find(o => o.valor === valor)?.rotulo || 'Falta';
  const classe = 'btn btn-outline ctrl-entrega' + (valor ? ' ctrl-entrega-feita' : '');
  if (!pode) return <span className={classe + ' ctrl-entrega-fixa'} title={rotulo + ': ' + nome} aria-label={rotulo + ': ' + nome}><SinalDaEntrega valor={valor} /></span>;
  return (
    <MenuSuspenso className={classe} flutuante titulo={rotulo} dica={rotulo + ': ' + nome}
      rotulo={<><SinalDaEntrega valor={valor} /><span className="sr-only">{rotulo + ': ' + nome}</span></>}
      itens={t.ENTREGAS_DO_CONTROLE.map(o => ({
        rotulo: <span className="ctrl-entrega-item"><SinalDaEntrega valor={o.valor} />{o.rotulo}</span>,
        marcado: o.valor === valor, onClick: () => { if (o.valor !== valor) aoMudar(o.valor); },
      }))} />
  );
}
