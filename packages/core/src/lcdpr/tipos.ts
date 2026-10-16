// O Importador LCDPR (o Livro Caixa Digital do Produtor Rural) que veio do Entregas (lcdpr.html) para dentro da empresa
// no nads (16/10/2026: "quero integrar no app o importador lcpr e o entregas, só que preciso que fique tudo no visual
// igual para não destoar do app"; "coloque o lcdpr como parte da empresa 62 de carlos lucas apenas").
// Os tipos: as regras e os cadastros (o documento lcdpr/config do banco do Entregas, com os MESMOS nomes de campo que a
// página antiga grava — ela continua funcionando junto) e o lançamento montado de um relatório do SIEG (esse não vai
// para lugar nenhum: é recriado reimportando os relatórios, como lá).

/** A Configuração geral (lcdpr/config → config). */
export interface ConfigGeral {
  /** CPF/CNPJ do produtor, só os dígitos: o CT-e só entra quando o destinatário é ele */
  cpfProdutor: string;
  contaCredoraPadrao: string;
  imovelPadrao: string;
  tipoDocPadrao: string;
  tipoLancPadrao: string;
  /** o nome da categoria usada em todo CT-e (frete) */
  categoriaFretesCTe: string;
}

/** Uma categoria: a conta, o código do histórico e o modelo do histórico ({{doc}}, {{fornecedor}}, {{cnpj}}). */
export interface Categoria { nome: string; conta: string; codHist: string; historico: string }
/** Uma conta do plano; tipo A (analítica) ou S (sintética), como a planilha do LCDPR usa. */
export interface ContaDoPlano { codigo: string; nome: string; classificacao: string; tipo: string }
/** Uma regra por NCM: o prefixo (capítulo/posição) manda a nota para a conta. A ORDEM importa: vale o primeiro prefixo que casa. */
export interface RegraNcm { prefixo: string; conta: string; codHist: string; historico: string }
export interface CodigoDescricao { codigo: string; descricao: string }
/** A IE do destinatário da nota (a fazenda que comprou) → o imóvel rural. */
export interface IeDoImovel { ie: string; imovel: string }

/** Tudo o que fica guardado (lcdpr/config): as regras e os cadastros. */
export interface ConfigLcdpr {
  config: ConfigGeral;
  categorias: Categoria[];
  planoContas: ContaDoPlano[];
  ncmRules: RegraNcm[];
  imoveis: CodigoDescricao[];
  ieDest: IeDoImovel[];
  tipoDoc: CodigoDescricao[];
  tipoLanc: CodigoDescricao[];
}

/** Os campos do documento, na ordem em que a página antiga grava (e o backup sai). */
export const CAMPOS_DA_CONFIG = ['config', 'categorias', 'planoContas', 'ncmRules', 'imoveis', 'ieDest', 'tipoDoc', 'tipoLanc'] as const;

/** As listas editáveis (as telas de Classificação e as Tabelas de apoio). */
export type ListaDoLcdpr = 'categorias' | 'planoContas' | 'ncmRules' | 'imoveis' | 'ieDest' | 'tipoDoc' | 'tipoLanc';
export type ItemDaLista<L extends ListaDoLcdpr> = ConfigLcdpr[L][number];

export type OrigemDoDocumento = 'NF' | 'CTe';
/** Como o lançamento foi classificado (a etiqueta da linha). */
export type OrigemDaRegra = 'NCM' | 'Padrão CT-e' | 'Manual' | 'Nenhuma';

/** Um lançamento montado de uma nota ou de um CT-e do SIEG. */
export interface Lancamento {
  id: number;
  origem: OrigemDoDocumento;
  /** aaaa-mm-dd ('' quando a planilha não trouxe) */
  data: string;
  documento: string;
  /** só os dígitos */
  cnpj: string;
  fornecedor: string;
  /** o nome da categoria que bate com a conta e o histórico ('' sem) */
  categoria: string;
  contaDeved: string;
  contaCred: string;
  codHist: string;
  historico: string;
  valor: number;
  imovel: string;
  tipoDoc: string;
  tipoLanc: string;
  /** os produtos da nota, separados por " | " */
  produto: string;
  /** os NCMs da nota (8 dígitos), separados por ", " */
  ncm: string;
  /** ainda sem conta: vai para REVISAR */
  revisar: boolean;
  origemRegra: OrigemDaRegra;
}

/** Os campos do lançamento que dá para corrigir à mão (a janela do lançamento). */
export type CampoEditavel = 'contaDeved' | 'contaCred' | 'codHist' | 'imovel' | 'tipoDoc' | 'tipoLanc' | 'cnpj' | 'documento' | 'valor' | 'historico' | 'produto';
