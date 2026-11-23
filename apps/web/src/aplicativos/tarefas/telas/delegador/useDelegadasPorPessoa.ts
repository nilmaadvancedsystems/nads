// ViewModel do Por pessoa das Delegadas por mim (23/11/2026: "quero tambem uma opção de ver dados de tarefas delegadas por usuario,
// quanto tempo tá demorando, etc, dados uteis para mim"): uma linha por pessoa que recebeu as minhas tarefas, com o que está com
// ela agora e o que fez no período (as regras: tarefas.delegadas.dadosPorPessoa). Só as tarefas, sem os documentos delegados
// (como a aba Tarefas); os tempos contam só o expediente.
import { tarefas } from '@nads/core';
import { useState } from 'react';
import { useTarefasDelegadas } from '../../dados/repo';

const d = tarefas.delegadas;

/** Os minutos para a tela ("—" sem caso; de 10 horas de expediente para cima, em dias de 9 horas). */
function tempo(min: number | null): string {
  if (min == null) return '—';
  if (min >= 600) return (min / 540).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' dias';
  return d.duracaoParaTela(min);
}

export function useDelegadasPorPessoa() {
  const repo = useTarefasDelegadas();
  const [periodo, setPeriodo] = useState<tarefas.delegadas.PeriodoDosDados>('30');
  const uid = repo.eu()?.uid || '';
  const lidas = repo.lista();
  const agora = new Date();
  const dados = d.dadosPorPessoa(lidas.tarefas.filter(t => !d.pedeDocumentos(t)), uid, d.inicioDoPeriodo(periodo, agora), agora);
  const soma = (f: (x: tarefas.delegadas.DadosDaPessoa) => number) => dados.reduce((s, x) => s + f(x), 0);
  const concluidas = soma(x => x.concluidas);
  const comPrazo = soma(x => x.comPrazo);
  return {
    carregando: !lidas.carregadas,
    periodo, setPeriodo,
    periodos: d.PERIODOS_DOS_DADOS.map(p => ({ valor: p.valor, rotulo: p.rotulo })),
    rotuloDoPeriodo: d.PERIODOS_DOS_DADOS.find(p => p.valor === periodo)?.rotulo || '',
    /** os números de cima: o de agora (em aberto, atrasadas) e o do período (concluídas, no prazo) */
    resumo: {
      abertas: soma(x => x.abertas), atrasadas: soma(x => x.atrasadas), concluidas,
      noPrazo: comPrazo ? Math.round(100 * (comPrazo - soma(x => x.foraDoPrazo)) / comPrazo) + '%' : '—',
    },
    pessoas: dados.map(x => ({
      ...x,
      ateVerTexto: tempo(x.ateVer), ateIniciarTexto: tempo(x.ateIniciar), ateConcluirTexto: tempo(x.ateConcluir),
      trabalhadoTexto: x.trabalhados ? tempo(x.trabalhados) : '—',
      /** "3 de 4 no prazo" (só as concluídas com prazo) */
      noPrazoTexto: x.comPrazo ? (x.comPrazo - x.foraDoPrazo) + ' de ' + x.comPrazo : '—',
      cobrancasDica: x.adiamentos ? x.adiamentos + (x.adiamentos > 1 ? ' pedidos' : ' pedido') + ' de mais tempo (' + x.minutosPedidos + ' min)' : 'Nenhum pedido de mais tempo',
      parada: x.maisAntigaParada ? { ...x.maisAntigaParada, ha: tarefas.quandoFoi(x.maisAntigaParada.desde, agora) } : null,
    })),
  };
}
