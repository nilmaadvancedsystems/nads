// Tipos do Cheque especial (gerador de lançamentos de ajuste de saldo negativo).
// Origem: cheque_especial.html — formatos dos objetos de findColumns (~L524),
// buildDailyClosingBalances (~L612), buildLancamentos (~L628) e renderResults (~L688).

/** Saldo de fechamento de um dia (a última linha do dia no relatório). */
export interface DiaSaldo {
  data: Date;
  saldo: number;
}

/** Onde estão o cabeçalho e as colunas Data e Saldo (índices a partir de 0). */
export interface Colunas {
  linhaCabecalho: number;
  colData: number;
  colSaldo: number;
}

export type TipoLancamento = 'Ajuste' | 'Estorno';

export interface Lancamento {
  data: Date;
  debito: string;
  credito: string;
  valor: number;
  historico: string;
  tipo: TipoLancamento;
  obs: string;
  /** Estorno com data projetada (próximo dia útil, fora do período do relatório). */
  projetado: boolean;
}

export interface ResultadoAjuste {
  lancamentos: Lancamento[];
  /** O relatório terminou negativo e o último estorno foi projetado ("trailing" no original). */
  projetado: boolean;
}

/** Os números dos cartões da tela de resultado. */
export interface ResumoAjuste {
  diasAnalisados: number;
  diasNegativos: number;
  totalAjustado: number;
  qtdLancamentos: number;
}
