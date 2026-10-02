// O que falta para a Conferência fiscal estar Ok no período (Vitor, 01/10/2026: "bloqueia se não estiver tudo ok"):
// a etapa da Tarefas só deixa avançar quando a lista estiver vazia. São os valores e os tiques (Vitor, 01/10/2026:
// "as pendências estão ligadas a esses valores e aos lançamentos fora do padrão que não foram tickados"):
//   o Relatório (Geral): cada conta com diferença (as de serviço ficam para Tomados/Prestados);
//   os lançamentos fora do padrão do CFOP (Entradas e Saídas) sem marcar como corrigidos;
//   Tomados e (quando a empresa presta serviço) Prestados: as contas com diferença e as notas fora do padrão.
// Ok, Ok pela revisão, Conferido, soma zero, sem conta e fora do balancete não travam.
import { brl } from '../../formatos';
import type { Empresa, FiltroMovimento, TipoServico } from '../tipos';
import type { Situacao } from './conciliacao';
import { semPrest } from './empresa';
import { foraDoPadraoFiscal } from './foraDoPadraoFiscal';
import { montarRelatorio } from './relatorio';
import { conferirServicos } from './servicosConferencia';

// o título já vem com a conta ("81016 — Despesas…"); sem ela, põe na frente
const conta = (contas: string[], titulo: string) => (contas.length && !titulo.startsWith(contas[0]) ? contas.join(', ') + ' — ' : '') + titulo;

function daSituacao(onde: string, contas: string[], titulo: string, sit: Situacao): string | null {
  return sit.tipo === 'diferenca' ? onde + conta(contas, titulo) + ': diferença de ' + brl(sit.diferenca) : null;
}

const notas = (n: number) => n + (n === 1 ? ' nota' : ' notas');

/** Uma pendência e onde ela está no Relatório (a aba): o "Resolver" da Tarefas leva até lá (Vitor, 02/10/2026). */
export interface PendenciaFiscal { texto: string; alvo: 'relatorio:geral' | 'relatorio:entradas' | 'relatorio:saidas' | 'relatorio:tomados' | 'relatorio:prestados' }

export function pendenciasDaConferenciaFiscal(e: Empresa, f: FiltroMovimento): string[] {
  return pendenciasFiscaisComLugar(e, f).map(p => p.texto);
}

export function pendenciasFiscaisComLugar(e: Empresa, f: FiltroMovimento): PendenciaFiscal[] {
  const r: PendenciaFiscal[] = [];
  for (const l of montarRelatorio(e, f, '').saldo) {
    if (l.emServicos) continue;
    const p = daSituacao('', l.contas, l.titulo, l.situacao);
    if (p) r.push({ texto: p, alvo: 'relatorio:geral' });
  }
  for (const t of ['entradas', 'saidas'] as const) {
    const q = foraDoPadraoFiscal(e, t, 'cfop').pendentes.reduce((s, g) => s + g.itens.length, 0);
    if (q) r.push({ texto: (t === 'entradas' ? 'Entradas' : 'Saídas') + ' fora do padrão do CFOP: ' + notas(q), alvo: t === 'entradas' ? 'relatorio:entradas' : 'relatorio:saidas' });
  }
  const servicos: TipoServico[] = semPrest(e) ? ['tomados'] : ['tomados', 'prestados'];
  for (const t of servicos) {
    const sv = conferirServicos(e, t, f, 'nome');
    const onde = (t === 'tomados' ? 'Tomados' : 'Prestados') + ' · ';
    for (const l of sv.saldo) {
      const p = daSituacao(onde, l.contas, l.titulo, l.situacao);
      if (p) r.push({ texto: p, alvo: t === 'tomados' ? 'relatorio:tomados' : 'relatorio:prestados' });
    }
    const q = sv.pendentes.reduce((s, g) => s + g.itens.length, 0);
    if (q) r.push({ texto: onde + 'fora do padrão: ' + notas(q), alvo: t === 'tomados' ? 'relatorio:tomados' : 'relatorio:prestados' });
  }
  return r;
}
