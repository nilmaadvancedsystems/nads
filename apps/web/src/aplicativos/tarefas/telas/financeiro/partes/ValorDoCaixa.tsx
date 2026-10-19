// O valor de um lançamento do caixa (19/10/2026): verde com + na entrada, vermelho com − na saída.
import { formatos, type financeiro } from '@nads/core';

export function ValorDoCaixa({ valor, tipo }: { valor: number; tipo: financeiro.TipoDeLancamento }) {
  return <span className={'fin-valor ' + (tipo === 'E' ? 'fin-valor-entrada' : 'fin-valor-saida')}>{tipo === 'E' ? '+' : '−'}{formatos.reais(valor)}</span>;
}
