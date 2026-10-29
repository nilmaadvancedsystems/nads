// As peças do Relatório (Fiscal › Relatório e Particularidades), vindas do Controle de tributos (27/10/2026: a folha do
// Protocolo de Entrega de Tributos; 28/10/2026: "remove a tela de controle de tributos, e pegue os dados de lá e coloque
// na tela nova"): o campo de valor, a conferência (a peça do catálogo) e a entrega. As Observações e a Retificação saíram
// por enquanto (28/10/2026: "remove isso por enquanto, irei pensar melhor como podemos implementar").
import { tarefas as t } from '@nads/core';
import { Icone, MenuSuspenso, type ItemMenu, type NomeIcone } from '@nads/ui';

/** O campo de valor da tabela: escreve à vontade e guarda ao sair (Enter também sai) */
/** estreito: o campo ocupa a célula da tabela do relatório, sem caixa em volta (29/10/2026: a tabela cabe na tela) */
/** molde: o formato ("dd/mm/aaaa") que aparece só ao escrever, para a coluna não ficar cheia dele (29/10/2026) */
export function Valor({ valor, sugestao, molde, rotulo, pode, aoSalvar, largo, estreito }: { valor: string; sugestao?: string; molde?: string; rotulo: string; pode: boolean; aoSalvar: (v: string) => void; largo?: boolean; estreito?: boolean }) {
  return (
    <input key={valor} type="text" className={'fin-valor-edita' + (largo ? '' : ' num') + (estreito ? ' rel-campo' : '') + (!sugestao && molde ? ' rel-molde' : '')}
      defaultValue={valor} placeholder={sugestao || molde || ''} aria-label={rotulo}
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

/** O ícone de cada jeito de entregar (Não se aplica fica sem) */
const ICONE_DA_ENTREGA: Record<t.EntregaDoControle, NomeIcone | undefined> = { '': 'clock', impresso: 'printer', zap: 'mensagem', email: 'envelope', nao: undefined };

/**
 * A entrega (29/10/2026: "melhore esse dropdown"): no lugar do select do navegador, a etiqueta com o ícone e o menu do nads
 * (o mesmo dos filtros, com o ✓ no escolhido). Falta fica tracejada; entregue, verde; Não se aplica, apagada. O menu
 * abre por cima da página (flutuante), para não ficar cortado pela tabela.
 */
export function Entrega({ valor, pode, rotulo, aoMudar }: { valor: t.EntregaDoControle; pode: boolean; rotulo: string; aoMudar: (e: t.EntregaDoControle) => void }) {
  const atual = t.ENTREGAS_DO_CONTROLE.find(o => o.valor === valor) ?? t.ENTREGAS_DO_CONTROLE[0];
  const classe = 'rel-entrega rel-entrega-' + (valor === '' ? 'falta' : valor === 'nao' ? 'nao' : 'feita');
  const icone = ICONE_DA_ENTREGA[atual.valor];
  const texto = <span className="rel-entrega-texto">{atual.rotulo}</span>;
  if (!pode) return <span className={classe + ' leitura'} title={rotulo + ': ' + atual.rotulo}>{icone && <Icone nome={icone} />}{texto}</span>;
  const item = (o: (typeof t.ENTREGAS_DO_CONTROLE)[number]): ItemMenu => ({ rotulo: o.rotulo, icone: ICONE_DA_ENTREGA[o.valor] ?? 'x', marcado: o.valor === valor, onClick: () => { if (o.valor !== valor) aoMudar(o.valor); } });
  const [falta, ...jeitos] = t.ENTREGAS_DO_CONTROLE;
  const nao = jeitos.filter(o => o.valor === 'nao');
  return (
    <MenuSuspenso className={classe} icone={icone} rotulo={texto} titulo={rotulo} dica={rotulo + ': ' + atual.rotulo} flutuante direita largura={180}
      itens={[item(falta), 'separador', ...jeitos.filter(o => o.valor !== 'nao').map(item), 'separador', ...nao.map(item)]} />
  );
}
