// ViewModel da etapa Conferência do Conversor: os números do extrato e as linhas como vão para o .xls.
import { extrator } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export function useConferencia() {
  const { estado } = useSessao();
  const linhas = estado.extrato?.linhas || [];
  const entradas = linhas.filter(l => l.valor > 0).reduce((t, l) => t + l.valor, 0);
  const saidas = linhas.filter(l => l.valor < 0).reduce((t, l) => t + l.valor, 0);
  return {
    qtd: linhas.length,
    entradas: extrator.reaisBR(entradas),
    saidas: extrator.reaisBR(saidas),
    movimento: extrator.reaisBR(entradas + saidas),
    linhas: linhas.map((l, i) => ({ id: i, data: extrator.dataBR(l.data), valor: extrator.valorBR(l.valor), historico: l.historico })),
  };
}
