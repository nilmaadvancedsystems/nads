// ViewModel de Financeiro › Resultado (22/10/2026, o item 6 da lista do Painel: "receitas menos despesas por conta,
// comparando com o mês e o ano anteriores"): o mês (começa no mês passado, que já fechou) e o resultado por conta
// (financeiro.resultadoPorConta), lido do Caixa e do plano de contas.
import { financeiro } from '@nads/core';
import { useMemo, useState } from 'react';
import { useCaixa } from '../../dados/repo';
import { hoje } from './formatosDaNota';

export function useResultadoPorConta() {
  const repo = useCaixa();
  const lanc = repo.lancamentos();
  const plano = repo.plano();
  const [mes, setMes] = useState(() => financeiro.competenciaAnterior(hoje()));
  const contas = useMemo(() => new Map(plano.lista.map(c => [c.id, c])), [plano.lista]);
  const valido = financeiro.competenciaValida(mes);
  const r = useMemo(() => (valido ? financeiro.resultadoPorConta(lanc.lista, contas, mes) : null), [lanc.lista, contas, mes, valido]);
  return {
    carregando: !lanc.carregada || !plano.carregada,
    erro: lanc.erro || plano.erro,
    exemplos: repo.exemplos,
    mes, setMes,
    resultado: r,
    colunas: r ? { atual: financeiro.competenciaBr(r.mes), anterior: financeiro.competenciaBr(r.anterior), anoPassado: financeiro.competenciaBr(r.anoPassado) } : null,
  };
}
