// O cadastro de uma empresa do escritório: as contas bancárias, o plano de contas (importado do Alterdata)
// e as contas padrão dos lançamentos. Pedido do Vitor (2026-09-30): um lugar só, na Tarefas (Cadastro),
// de onde o Extrator (os bancos) e o Creditor (plano e contas padrão) leem.

/** Tipo da conta no banco (só para mostrar; nenhuma regra depende dele). */
export type TipoContaBancaria = 'corrente' | 'aplicacao' | 'poupanca' | 'outra';

/**
 * Uma conta da empresa num banco. id = marca + agência + conta (só números e letras), o mesmo das linhas do
 * Extrator, para os arquivos já importados continuarem na conta certa.
 */
export interface ContaBancaria {
  id: string;
  /** o banco (o logo): o id em BANCOS_CONHECIDOS, ou 'outro' */
  marca: string;
  /** como aparece na tela: "Sicoob", "Itaú" */
  nome: string;
  agencia?: string;
  conta?: string;
  tipo?: TipoContaBancaria;
  /** o nome que o escritório usa: "Conta movimento", "Aplicação automática" */
  apelido?: string;
  /** o código da conta contábil do banco no plano (ex.: 10503) */
  contaContabil?: string;
  /** a primeira competência da conta ('aaaa-mm'); sem = desde sempre */
  desde?: string;
  /** a última competência da conta ('aaaa-mm'), quando foi encerrada */
  ate?: string;
}

/** Uma conta do plano de contas da empresa. */
export interface ContaDoPlano {
  /** o código reduzido do Alterdata (o que vai nos lançamentos) */
  codigo: string;
  nome: string;
  /** a classificação (1.1.01.002), quando o arquivo traz */
  classificacao?: string;
  /** Ativo, Passivo, Receita, Despesa (quando dá para saber) */
  grupo?: string;
  /** conta de título (não recebe lançamento) */
  sintetica?: boolean;
  /** posição no plano */
  ordem: number;
}

export interface PlanoDeContas {
  contas: ContaDoPlano[];
  /** de onde veio: um arquivo do Alterdata, ou o balancete que a Conferência guardou */
  origem: 'arquivo' | 'balancete';
  /** o nome do arquivo importado */
  arquivo?: string;
  /** ISO */
  importadoEm: string;
  /** quem importou */
  por?: string;
}

/** As contas padrão dos lançamentos (as mesmas chaves do layout do Creditor). */
export type CampoContaPadrao = 'banco' | 'juros' | 'desconto' | 'histPrincipal' | 'histJuros' | 'histDesconto' | 'cartao';
/** As que são contas do plano (os históricos não são). */
export type ContaPadraoDoPlano = 'banco' | 'juros' | 'desconto' | 'cartao';

export interface ContasPadrao {
  contas: Partial<Record<CampoContaPadrao, string>>;
  /** o nome da conta no plano quando foi escolhida (para avisar se mudar) */
  nomes: Partial<Record<ContaPadraoDoPlano, string>>;
}

/** O que mudou no cadastro, com pessoa e hora (os mais novos primeiro). */
export interface RegistroCadastro {
  /** ISO */
  ts: string;
  por: string;
  acao: string;
  detalhe: string;
}

/** Um sócio da empresa: o nome e o CPF (só os dígitos). */
export interface Socio { nome: string; cpf: string }

export interface CadastroDaEmpresa {
  nome: string;
  codigo: number | null;
  /** null = os bancos nunca foram cadastrados (os aplicativos seguem com o que tinham antes) */
  bancos: ContaBancaria[] | null;
  /** null = as contas padrão nunca foram cadastradas (o Creditor segue com as que ele salvou) */
  contasPadrao: ContasPadrao | null;
  /**
   * A empresa presta serviços? (Vitor, 30/09/2026: a regra fica no Cadastro.) Decide a aba Prestados na Importação
   * e os serviços prestados na Conferência. Sem = ainda não informado.
   */
  prestaServico?: boolean;
  /**
   * Os cartões da empresa (Vitor, 07/10/2026: "se a empresa tem cartão empresarial ou venda de cartão, vai ficar no
   * cadastro"): ligam a etapa Cartões na Tarefas. Sem = ainda não informado.
   */
  cartaoEmpresarial?: boolean;
  vendeNoCartao?: boolean;
  /** os sócios, com o nome e o CPF (Vitor, 06/10/2026): a etapa Bancos acha a transferência para o sócio no extrato */
  socios?: Socio[];
  /**
   * quem cuida da empresa no Fiscal e no Contábil (Vitor, 06/10/2026: "o cadastro por responsável"): o nome da pessoa
   * da equipe. Sem = ninguém escolhido (no Fiscal, vale o da planilha do Checklist Folha, que é do Fiscal).
   */
  responsaveis?: Partial<Record<DepartamentoDoResponsavel, string>>;
  /** as transferências de responsável pedidas e ainda não aceitas pelos dois (uma por departamento) */
  transferencias?: Partial<Record<DepartamentoDoResponsavel, TransferenciaDeResponsavel>>;
  /** os parâmetros do DP mudados nas Configurações do DP (o que não está aqui vale o da planilha do DP) */
  dp?: ParametrosDoDp;
  /** a empresa foi cadastrada pelo nads (Vitor, 07/10/2026: "um cadastro de empresas sem o botão de cadastrar empresa"): o regime */
  nova?: { regime: string; criadaEm: string };
  historico: RegistroCadastro[];
  /** o resumo do plano de contas (o plano mora em outro documento): para a lista de empresas */
  plano?: { contas: number; importadoEm: string };
  atualizadoEm?: string;
}

/** Os departamentos que têm responsável por empresa (Vitor, 06/10/2026: os responsáveis da planilha são do Fiscal; o DP não tem). */
export type DepartamentoDoResponsavel = 'fiscal' | 'contabil';
export const DEPARTAMENTOS_DO_RESPONSAVEL: readonly { id: DepartamentoDoResponsavel; rotulo: string }[] = [
  { id: 'fiscal', rotulo: 'Fiscal' }, { id: 'contabil', rotulo: 'Contábil' },
];

/** Os parâmetros do DP de uma empresa (Configurações do DP): só os que foram mudados. */
export interface ParametrosDoDpDoMes {
  movimento?: string;
  /** as obrigações do mês (recibos, folha, s1200, s1210, s1299, dctfweb, darf, fgts) */
  obrigacoes?: string[];
  reinfAutorizada?: boolean;
  entrega?: string;
  agrupamento?: string;
}

/**
 * Os parâmetros do DP: os de sempre e os por competência (Vitor, 07/10/2026: "configurações por competência"). Cada
 * competência (AAAA-MM) vale dela em diante, até a próxima que mudar o mesmo campo.
 */
export interface ParametrosDoDp extends ParametrosDoDpDoMes {
  porCompetencia?: Record<string, ParametrosDoDpDoMes>;
}

/**
 * Uma transferência de responsável (Vitor, 07/10/2026: "a empresa seria transferida com a permissão do emitente e do
 * destinatário"): pedida por alguém; só vira o novo responsável quando o emitente (quem é hoje) e o destinatário aceitam.
 */
export interface TransferenciaDeResponsavel {
  /** o emitente: o responsável de hoje */
  de: string;
  /** o destinatário */
  para: string;
  pedidoPor: string;
  /** ISO */
  em: string;
  /** quando o emitente aceitou (ISO) */
  aceiteDe?: string;
  /** quando o destinatário aceitou (ISO) */
  aceitePara?: string;
  /** a troca de que faz parte (Vitor, 07/10/2026: "realmente uma troca"): as empresas de uma troca vão e voltam juntas */
  troca?: string;
}
