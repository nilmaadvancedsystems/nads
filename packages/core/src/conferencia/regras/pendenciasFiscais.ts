// O que falta para a Conferência fiscal estar Ok no período (Vitor, 01/10/2026: "bloqueia se não estiver tudo ok"):
// a etapa da Tarefas só deixa avançar quando a lista estiver vazia. Entra:
//   o Relatório (Geral): cada conta com diferença, sem conta configurada ou fora do balancete lido (as contas de
//     serviço ficam para Tomados/Prestados);
//   as naturezas do período sem conferir (Naturezas de CFOP);
//   os lançamentos fora do padrão do CFOP (Entradas e Saídas) sem marcar como corrigidos;
//   Tomados e (quando a empresa presta serviço) Prestados: as contas com diferença e as notas fora do padrão.
// Ok, Ok pela revisão, Conferido e soma zero passam.
import { brl } from '../../formatos';
import type { Empresa, FiltroMovimento, TipoServico } from '../tipos';
import { montarChecklist } from './checklist';
import type { Situacao } from './conciliacao';
import { semPrest } from './empresa';
import { foraDoPadraoFiscal } from './foraDoPadraoFiscal';
import { montarRelatorio } from './relatorio';
import { conferirServicos } from './servicosConferencia';

const conta = (contas: string[], titulo: string) => (contas.length ? contas.join(', ') + ' — ' : '') + titulo;

function daSituacao(onde: string, contas: string[], titulo: string, sit: Situacao): string | null {
  if (sit.tipo === 'diferenca') return onde + conta(contas, titulo) + ': diferença de ' + brl(sit.diferenca);
  if (sit.tipo === 'sem-conta') return onde + titulo + ': sem conta configurada';
  if (sit.tipo === 'fora-do-balancete') return onde + conta(contas, titulo) + ': fora do balancete';
  return null;
}

const notas = (n: number) => n + (n === 1 ? ' nota' : ' notas');

export function pendenciasDaConferenciaFiscal(e: Empresa, f: FiltroMovimento): string[] {
  const r: string[] = [];
  for (const l of montarRelatorio(e, f, '').saldo) {
    if (l.emServicos) continue;
    const p = daSituacao('', l.contas, l.titulo, l.situacao);
    if (p) r.push(p);
  }
  const semConferir = montarChecklist(e, f).linhas.filter(l => !l.marcado && !l.naoContabil).length;
  if (semConferir) r.push('Naturezas sem conferir: ' + semConferir);
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
