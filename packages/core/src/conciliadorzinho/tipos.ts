// Tipos do Conciliadorzinho (conciliação de cartão × notas de venda).
// Origem: conciliadorZINHO.html — formatos dos objetos de parseCardStatementFile (~L870),
// parseSalesFile (~L923), computeMonthTally (~L985), generateMultiBrandDatasets (~L1477),
// state.accounts (~L979), buildFinalOutputs (~L1817) e buildSaidaOutputs (~L2077).

/** As operadoras que o original conhece (BRAND_LIST ~L967). */
export type IdBandeira = 'cielo' | 'rede' | 'getnet' | 'stone' | 'pagbank';

/** BRAND_META sem o logo (o logo é da tela: @nads/ui/logosBandeiras). */
export interface Bandeira { id: IdBandeira; rotulo: string; slug: string }

/** Competência: mês 1-12 e ano (o { month, year } do original). */
export interface Mes { mes: number; ano: number }

/** Competência com a quantidade de lançamentos (o { month, year, count } do computeMonthTally). */
export interface MesContagem extends Mes { qtd: number }

/** Um lançamento do extrato da bandeira. chaveData = 'dd/mm/aaaa'. */
export interface Transacao { data: Date; chaveData: string; bruto: number; taxa: number }

/** Uma linha da planilha de vendas (notas fiscais). */
export interface Venda {
  data: Date;
  chaveData: string;
  bruto: number;
  /** Primeiro trecho do histórico limpo ("200294" em "200294-0-CONSUMIDOR FINAL"). */
  nf: string;
  /** Histórico limpo: "[NF]-[cpf/cnpj]-[NOME]". */
  historico: string;
  /** Coluna E. */
  contrapartida: string;
  /** Coluna H (código do histórico). */
  codigoHistorico: string;
}

/** Uma linha conciliada (antes de trocar pelas contas): Bruto e Taxa de cada lançamento. */
export interface LinhaConciliada {
  tipo: 'Bruto' | 'Taxa';
  casou: boolean;
  chaveData: string;
  valor: number;
  /** '15' (bruto com nota), '181' (bruto sem nota) ou '92060' (taxa). */
  historico: string;
  /** Histórico da venda casada; vazio quando não casou. */
  complemento: string;
  nota: string;
}

/** O dataset de uma bandeira (byBrand[code] do original). */
export interface ResultadoBandeira {
  meses: MesContagem[];
  aprovadas: number;
  casadas: number;
  semNota: number;
  totalBruto: number;
  totalTaxa: number;
  linhas: LinhaConciliada[];
}

/** Resultado da conciliação: por bandeira + vendas que nenhuma bandeira pegou (vão para Saídas). */
export interface Conciliacao { porBandeira: Partial<Record<IdBandeira, ResultadoBandeira>>; sobras: Venda[] }

/** Totais de um mês (o que renderTotalsBreakdown mostra). */
export interface TotalDoMes {
  mes: Mes;
  rotulo: string;
  vendasComCartao: number;
  vendasSemCartao: number;
  totalVendas: number;
  porBandeira: { id: IdBandeira; bruto: number; taxa: number }[];
}

/** Contas padrão (state.accounts). Caixa usado = caixaPadrao ? '10101' : caixa.trim(). */
export interface Contas { vendas: string; taxas: string; caixaPadrao: boolean; caixa: string }

/** Uma linha do arquivo final (bandeira ou saídas). */
export interface LinhaArquivo {
  devedora: string;
  credora: string;
  data: string;
  valor: number;
  historico: string;
  complemento: string;
  nota: string;
  tipo: 'Bruto' | 'Taxa' | 'Saida';
  casou: boolean;
}

/** Um arquivo de saídas (vendas sem cartão) de um mês. */
export interface SaidaDoMes { chave: string; mes: Mes; rotulo: string; linhas: LinhaArquivo[]; nomeBase: string }
