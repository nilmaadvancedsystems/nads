// nads → SCI (23/11/2026, docs/sci): o Contábil passa para o SCI (Único / Novo Visual), mas lá só entram importações,
// em planilha (decisão do dono: "planilha é melhor para a análise"; o SBS, que daria a API, é pago à parte). O
// intermediário não usa banco: arquivo entra (a planilha de importação que as telas do nads já baixam), arquivo sai (a
// planilha que o gerador do SCI lê em Integrações › Importações › Lançamentos contábeis via planilha).

/** Uma linha da planilha de importação do nads (o .xls de 10 colunas do Alterdata, creditor/arquivos/gerar.ts). */
export interface LinhaDoNads {
  /** aaaa-mm-dd */
  data: string;
  debito: string;
  credito: string;
  /** em centavos, sempre positivo */
  valor: number;
  codHistorico: string;
  complemento: string;
  documento: string;
  /** de onde veio (o nome do arquivo: lancatudo_…, creditor_importacao_…, cartao_importacao_…) */
  origem: string;
}

/** A conta do SCI que corresponde a uma conta do nads (a planilha de de/para do escritório). */
export interface ContaNoSci {
  codigo: string;
  /** o nome, quando a planilha de de/para traz (só para a análise) */
  nome: string;
}

/** O de/para das contas: código do nads (o reduzido do Alterdata) → a conta do SCI. */
export type DeParaDasContas = ReadonlyMap<string, ContaNoSci>;

export interface OpcoesDoSci {
  /** CNPJ da empresa que recebe (a matriz ou a filial); vai em todas as linhas */
  cnpjEmpresa: string;
  /** o lote (até 10 letras) que marca o que o nads mandou, para excluir e refazer pelo filtro no SCI */
  lote?: string;
  /** o histórico das linhas que vieram sem código */
  historicoPadrao?: string;
  /** sem = as contas vão como vieram (o SCI com os mesmos códigos do Alterdata) */
  dePara?: DeParaDasContas | null;
}

/** Um lançamento pronto para a planilha do SCI, com o que impede a importação. */
export interface LancamentoSci {
  data: string;
  debito: string;
  credito: string;
  /** centavos */
  valor: number;
  historico: string;
  complemento: string;
  documento: string;
  lote: string;
  cnpjEmpresa: string;
  participanteD: string;
  participanteC: string;
  nomeD: string;
  nomeC: string;
  origem: string;
  /** vazio = pronto para importar */
  problemas: string[];
}

export interface ResumoDoSci {
  total: number;
  prontos: number;
  comProblema: number;
  /** centavos dos prontos */
  valorPronto: number;
  porOrigem: { origem: string; linhas: number; comProblema: number }[];
  /** os meses (aaaa-mm) das linhas, em ordem */
  meses: string[];
}
