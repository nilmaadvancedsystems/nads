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

export function pendenciasDaConferenciaFiscal(e: Empresa, f: FiltroMovimento): string[] {
  const r: string[] = [];
  for (const l of montarRelatorio(e, f, '').saldo) {
    if (l.emServicos) continue;
    const p = daSituacao('', l.contas, l.titulo, l.situacao);
    if (p) r.push(p);
  }
  for (const t of ['entradas', 'saidas'] as const) {
    const q = foraDoPadraoFiscal(e, t, 'cfop').pendentes.reduce((s, g) => s + g.itens.length, 0);
    if (q) r.push((t === 'entradas' ? 'Entradas' : 'Saídas') + ' fora do padrão do CFOP: ' + notas(q));
  }
  const servicos: TipoServico[] = semPrest(e) ? ['tomados'] : ['tomados', 'prestados'];
  for (const t of servicos) {
    const sv = conferirServicos(e, t, f, 'nome');
    const onde = (t === 'tomados' ? 'Tomados' : 'Prestados') + ' · ';
    for (const l of sv.saldo) {
      const p = daSituacao(onde, l.contas, l.titulo, l.situacao);
      if (p) r.push(p);
    }
    const q = sv.pendentes.reduce((s, g) => s + g.itens.length, 0);
    if (q) r.push(onde + 'fora do padrão: ' + notas(q));
  }
  return r;
}
