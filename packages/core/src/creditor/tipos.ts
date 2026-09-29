// Tipos do Creditor: conciliação do relatório de liquidação do banco (cobrança) com o arquivo
// do sistema, gerando o arquivo de importação contábil de 8 colunas.
// Origem: o prompt "Conciliação Bancária (Relatório de Liquidação x Sistema Contábil)" do Vitor (2026-09-28).

/** Um título liquidado, como veio do relatório do banco (a pessoa pode corrigir na conferência). */
export interface Titulo {
  id: number;
  sacado: string;
  nossoNumero: string;
  /** "Seu Número" = número da nota fiscal, como veio */
  nf: string;
  /** Valor (R$): o valor original da NF */
  valor: number;
  /** Vlr. Mora (0 quando não tem) */
  mora: number;
  /** Vlr. Desc. (0 quando não tem) */
  desconto: number;
  /** Vlr. Outros Acresc. (0 quando não tem); vai junto com a mora no lançamento B */
  outros: number;
  /** Dt. Liquidação, DD/MM/AAAA */
  liquidacao: string;
  /** Vlr. Cobrado; null quando o relatório não traz */
  cobrado: number | null;
  /** aviso da leitura (ex.: colunas de valor adivinhadas) */
  aviso?: string;
}

export type ColunaValor = 'valor' | 'mora' | 'desconto' | 'outros' | 'cobrado';

/** Totais impressos no relatório ("Total de Valores do grupo"); null = não veio. */
export type TotaisImpressos = Record<ColunaValor, number | null>;

export interface Grupo {
  id: number;
  /** o tipo de liquidação do relatório (ex.: "58-LIQUIDAÇÃO - VIA COMPENSAÇÃO"), quando vem */
  rotulo?: string;
  titulos: Titulo[];
  impresso: TotaisImpressos;
  /** "Total de Registros do grupo" impresso (null = não veio) */
  registros?: number | null;
}

export interface RelatorioBanco {
  grupos: Grupo[];
  /** "Total de Valores Liquidados" do fim do relatório */
  totalGeral: TotaisImpressos;
  /** "Total de Registros Liquidados" */
  registrosGeral?: number | null;
  /** linhas de "Baixa - Pedido Cedente" (não são dinheiro recebido) que ficaram de fora */
  ignorados: number;
  avisos: string[];
}

/** Uma linha do arquivo do sistema (recebimentos de clientes). */
export interface LinhaSistema {
  /** número da linha no arquivo (a partir de 1), para a pessoa achar */
  linha: number;
  nf: string;
  cliente: string;
  contrapartida: string;
  historico: string;
  valor: number | null;
}

/** As contas e códigos de histórico do layout (os padrões são os do prompt; dá para trocar na tela). */
export interface ContasCreditor {
  banco: string;
  juros: string;
  desconto: string;
  histPrincipal: string;
  histJuros: string;
  histDesconto: string;
}

export const CONTAS_PADRAO: ContasCreditor = {
  banco: '10503', juros: '97304', desconto: '85001', histPrincipal: '246', histJuros: '59648', histDesconto: '256',
};

export type TipoLancamento = 'principal' | 'mora' | 'desconto';

/** Uma linha do arquivo de importação (layout de 8 colunas). */
export interface Lancamento {
  automatico: string;
  /** DD/MM/AAAA */
  data: string;
  debito: string;
  credito: string;
  codHistorico: string;
  historico: string;
  valor: number;
  /** número da NF, só dígitos */
  documento: string;
  tipo: TipoLancamento;
  tituloId: number;
}
