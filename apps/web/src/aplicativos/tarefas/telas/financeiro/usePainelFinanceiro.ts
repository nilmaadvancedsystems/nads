// ViewModel de Financeiro › Painel (22/10/2026: "no financeiro, faça um dashboard de entradas, saídas dentre outros"):
// o período (este mês, mês passado, este ano), os números do período (entradas, saídas, resultado e o saldo de hoje), o
// mês a mês dos últimos 12 meses, para onde vai e de onde vem o dinheiro (por conta do plano), os honorários
// do mês passado (recebidos e em aberto) e as notas fiscais do período. Tudo lido das listas ao vivo que o Caixa, os
// Honorários e as Notas já usam (nada novo no banco).
import { financeiro, type nfse } from '@nads/core';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { useCaixa, useHonorarios, useNfse } from '../../dados/repo';
import { hoje } from './formatosDaNota';

export type PeriodoDoPainel = 'este-mes' | 'mes-passado' | 'este-ano';
export const PERIODOS_DO_PAINEL: { valor: PeriodoDoPainel; rotulo: string }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' }, { valor: 'mes-passado', rotulo: 'Mês passado' }, { valor: 'este-ano', rotulo: 'Este ano' },
];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** as notas que contam como emitidas (autorizadas e não canceladas) */
const emitida = (n: nfse.NotaFiscal) => n.status === 'autorizada';

export function usePainelFinanceiro() {
  const caixa = useCaixa();
  const lanc = caixa.lancamentos();
  const plano = caixa.plano();
  const hon = useHonorarios();
  const contratos = hon.contratos();
  const recebimentos = hon.recebimentos();
  const notas = useNfse().notas();
  const navegar = useNavigate();
  const [periodo, setPeriodo] = useState<PeriodoDoPainel>('este-mes');
  const dia = hoje();
  const { de, ate } = financeiro.periodoPronto(periodo, dia);
  const contas = useMemo(() => new Map(plano.lista.map(c => [c.id, c])), [plano.lista]);
  const resumo = useMemo(() => financeiro.resumoDoPeriodo(lanc.lista, de, ate), [lanc.lista, de, ate]);
  const meses = useMemo(() => financeiro.caixaPorMes(lanc.lista, financeiro.ultimosMeses(dia)), [lanc.lista, dia]);
  const competencia = financeiro.competenciaAnterior(dia);
  const honorarios = useMemo(() => financeiro.situacaoDaCompetencia(contratos.lista, recebimentos.lista, competencia), [contratos.lista, recebimentos.lista, competencia]);
  const notasDoPeriodo = notas.lista.filter(n => emitida(n) && n.servico.competencia >= de && n.servico.competencia <= ate);
  return {
    carregando: !lanc.carregada || !plano.carregada,
    exemplos: caixa.exemplos,
    periodo, setPeriodo, periodos: PERIODOS_DO_PAINEL,
    numeros: { entradas: resumo.entradas, saidas: resumo.saidas, resultado: Math.round((resumo.entradas - resumo.saidas) * 100) / 100, saldo: financeiro.saldoDeHoje(lanc.lista, dia), lancamentos: resumo.lancamentos.length },
    /** os meses em tabela (do mais novo ao mais antigo) */
    meses: [...meses].reverse().map(m => ({ ...m, rotulo: MESES[Number(m.mes.slice(5)) - 1] + '/' + m.mes.slice(0, 4) })),
    saidasPorConta: financeiro.totaisPorConta(lanc.lista, 'S', de, ate, contas),
    entradasPorConta: financeiro.totaisPorConta(lanc.lista, 'E', de, ate, contas),
    honorarios: { competencia: financeiro.competenciaBr(competencia), carregado: contratos.carregada && recebimentos.carregada, ...honorarios, pct: honorarios.previsto ? Math.round((honorarios.recebido / honorarios.previsto) * 100) : 0 },
    notas: { carregada: notas.carregada, quantas: notasDoPeriodo.length, valor: notasDoPeriodo.reduce((s, n) => s + Math.round(n.servico.valor * 100), 0) / 100 },
    ir: (pagina: 'caixa' | 'honorarios' | 'notas') => navegar(caminhoDaPagina('financeiro', pagina)),
  };
}
