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
  /** o código da conta do cheque especial desta conta no plano (Vitor, 13/10/2026: gravado na primeira vez, na etapa Cheque especial) */
  contaChequeEspecial?: string;
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
/** A conta do razão de cada tipo, informada na etapa quando o nads não acha (o botão Vitor pede o razão dela; 19/11/2026). */
export type CampoContaDoRazao = 'razao-caixa' | 'razao-inss' | 'razao-salarios' | 'razao-fgts' | 'razao-prolabore' | 'razao-simples' | 'razao-honorarios'
  | 'razao-adiantamento-fornecedores' | 'razao-adiantamento-clientes' | 'razao-adiantamento-salarial'
  /** os empréstimos: várias contas, separadas por vírgula */
  | 'razao-emprestimos';
export type CampoContaPadrao = 'banco' | 'juros' | 'desconto' | 'histPrincipal' | 'histJuros' | 'histDesconto' | 'cartao';
/** As que são contas do plano (os históricos não são). */
export type ContaPadraoDoPlano = 'banco' | 'juros' | 'desconto' | 'cartao';

export interface ContasPadrao {
  contas: Partial<Record<CampoContaPadrao | CampoContaDoRazao, string>>;
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

/** A escolha do lembrete de vencimento de uma empresa (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente"). */
export interface LembreteDaEmpresa { modo: 'sim' | 'nao'; /** 0 a 10; sem = os dias do escritório */ diasAntes?: number }

/**
 * Um arquivo do Fiscal da empresa no Drive (Heverton, 20/10/2026: "Cadastro = Fiscal (inserir)": a planilha da DEFIS, a
 * da projeção do Fator R, a de rateio e os documentos da empresa): o nome, o link e quando foi posto ou trocado (e por
 * quem). Só o link: o arquivo continua no Drive.
 */
export interface ArquivoDoFiscal { nome: string; link: string; atualizadoEm: string; por: string }
/** As planilhas fixas do Fiscal (uma de cada) e os outros documentos */
export type PlanilhaDoFiscal = 'defis' | 'fatorR' | 'rateio';
export interface DocumentosDoFiscal { planilhas?: Partial<Record<PlanilhaDoFiscal, ArquivoDoFiscal>>; outros?: ArquivoDoFiscal[] }
/**
 * A antecipação do ICMS do ES da empresa (Fiscal › Antecipação ICMS-ES; Heverton, 22/10/2026): a alíquota interna (sem = a
 * padrão, 17%) e a situação marcada em cada linha (pelo id da linha: a chave da nota, o CFOP, o CST e a alíquota), com
 * quem marcou e quando. A situação é o id de tarefas.sieg.SITUACOES_DA_ANTECIPACAO.
 */
export interface AntecipacaoDoFiscal {
  aliquota?: number; situacoes?: Record<string, { situacao: string; por: string; em: string }>;
  /** a alíquota interestadual corrigida de uma linha, pelo id da linha (ticket PK6RIE, 12/11/2026) */
  aliquotas?: Record<string, { aliquota: number; por: string; em: string }>;
}

/** Um empréstimo no Cadastro: o contrato, o banco (id da conta bancária) e de quando até quando ele vale ('aaaa-mm'). */
export interface EmprestimoDaEmpresa { numero: string; banco: string; desde: string; ate?: string }

/** Uma razão social que a empresa já teve no nads: o nome e até quando valeu (ISO). */
export interface RazaoSocialAnterior { nome: string; ate: string }

/**
 * A razão social trocada pelo nads (13/11/2026: "poder trocar a razão social pelo próprio sistema"). Só para mostrar e
 * buscar: a chave da empresa continua o `nome` (o slug dele é o id do cadastro, dos extratos, da Conferência, das rotinas,
 * do cofre e do "onde parou"), para nada se perder. Quem trocou e quando; as anteriores, a mais nova primeiro.
 */
export interface RazaoSocialDoCadastro { atual: string; em: string; por: string; anteriores: RazaoSocialAnterior[] }

/** Uma atividade (CNAE) na Receita: o código com a máscara (4711-3/02) e a descrição. */
export interface AtividadeDaReceita { codigo: string; descricao: string }
/** Um sócio do quadro (QSA) na Receita: o CPF vem mascarado na fonte e fica de fora. */
export interface SocioNaReceita { nome: string; qualificacao: string; desde: string }
/** A opção pelo Simples ou pelo MEI na Receita: optante null = a fonte não disse. */
export interface OpcaoNaReceita { optante: boolean | null; desde: string; exclusao: string }

/** O que a Receita diz da empresa, lido da consulta (situacaoNaReceita.ts). */
export interface RetratoDaReceita {
  cnpj: string;
  /** ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA */
  situacao: string;
  situacaoDesde: string;
  /** o motivo da situação (vazio na empresa ativa sem motivo) */
  motivoSituacao: string;
  razaoSocial: string;
  fantasia: string;
  /** o logradouro, o número, o bairro e o município/UF (o mesmo jeito do vigia do Entregas, para comparar) */
  endereco: string;
  complemento: string;
  cep: string;
  cnae: AtividadeDaReceita | null;
  cnaesSecundarios: AtividadeDaReceita[];
  naturezaJuridica: string;
  porte: string;
  /** em reais (null = a fonte não disse) */
  capitalSocial: number | null;
  abertura: string;
  socios: SocioNaReceita[];
  simples: OpcaoNaReceita;
  mei: OpcaoNaReceita;
  /** quando foi consultado (ISO) */
  consultadoEm: string;
}

/**
 * O retrato da Receita que o nads guarda (17/11/2026: o botão Consultar na Receita do Cadastro › Empresa): só os campos que
 * alguém escolheu gravar (e os que estavam iguais), com quem conferiu e quando.
 */
export type ReceitaNoCadastro = Partial<Omit<RetratoDaReceita, 'consultadoEm'>> & { conferidoEm: string; por: string };

export interface CadastroDaEmpresa {
  /** o nome de sempre: é a CHAVE da empresa (nunca muda). Para mostrar, vale a razão social (razaoSocialDoCadastro) */
  nome: string;
  /** a razão social trocada no nads (sem = vale o nome) */
  razaoSocial?: RazaoSocialDoCadastro;
  /** o que a Receita disse, gravado pelo botão Consultar na Receita (sem = vale o que o Entregas sabe) */
  receita?: ReceitaNoCadastro;
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
  /**
   * A empresa recebe liquidação de cobrança do banco no caixa (CRÉD.LIQ.COBRANÇA)? (Vitor, 08/10/2026.) Sim: a etapa
   * Creditor entra em todos os meses do período. Não ou sem resposta: entra só nos meses do razão do caixa com a liquidação.
   */
  credLiquidacao?: boolean;
  /**
   * De quais bancos vem o relatório de liquidação (Vitor, 14/10/2026: "coloca no cadastro da empresa checks, Bradesco e
   * Sicoob"): o importar automático do Creditor procura os desses bancos, só no formato de cada um, e avisa o que falta.
   * Sem = não informado (procura os dois).
   */
  relatoriosDeLiquidacao?: BancoDoRelatorio[];
  /**
   * O escritório emite nota de honorário para a empresa? (Vitor, 07/10/2026.) Sim: a provisão chega pela nota (Fiscal) e a
   * etapa Honorários só confere o razão. Não: a pessoa importa o Extrato por cobrança e baixa os lançamentos para o
   * Alterdata. Sem = ainda não informado.
   */
  emiteNotaHonorario?: boolean;
  /**
   * A empresa está no SCI? (Vitor, 24/11/2026: "coloca uma opção de ligar na empresa se ela está no SCI para esses tipos de
   * aplicacoes apresentarem elas, ja que sairam do alterdata".) Só as ligadas aparecem no minimum. Sem = não está.
   */
  noSci?: boolean;
  /**
   * O lembrete de vencimento ao cliente desta empresa (17/11/2026, o dono: "quero que a parte de vencimento tenha como escolher por cliente"): 'sim' manda mesmo com o
   * lembrete geral desligado, 'nao' nunca manda; diasAntes troca os dias do escritório. Sem = como o escritório
   * (Robôs › Ajustes).
   */
  lembreteVencimento?: LembreteDaEmpresa;
  /**
   * O pagamento do pró-labore (Vitor, 14/10/2026: "deixa ele salvo na empresa"): a conta do crédito (o código digitado) e
   * o dia útil do mês seguinte (1 a 5). Sem = ainda não informado (o dia útil fica o 5º).
   */
  proLabore?: { contaCredito?: string; diaUtil?: number };
  /**
   * O regime tributário (13/10/2026: "no cadastro da empresa tenha os regimes, aí muda na rotina"): vale no lugar do da
   * lista do escritório e decide as etapas da rotina (o PGDAS no Simples; ICMS, PIS/COFINS, IRPJ/CSLL e as EFDs no
   * Presumido e no Real). Sem = o da lista.
   */
  regime?: string;
  /**
   * o CNPJ (só os números), quando a empresa foi cadastrada pela consulta da Receita (13/10/2026), ou digitado nas
   * Configurações do DP (20/10/2026); do cliente pessoa física, o CPF (11 números)
   */
  cnpj?: string;
  /**
   * O contato da empresa (Vitor, 07/10/2026): o e-mail e o WhatsApp para onde o Mandei manda as perguntas (Clientes e
   * Fornecedores › Envio). O WhatsApp só com os números, com o DDD (ex.: 38999998888). Sem = não cadastrado.
   */
  contato?: { email?: string; whatsapp?: string; outrosEmails?: string[] };
  /** os sócios, com o nome e o CPF (Vitor, 06/10/2026): a etapa Bancos acha a transferência para o sócio no extrato */
  socios?: Socio[];
  /**
   * Os empréstimos da empresa (Vitor, 07/10/2026): o número do contrato, o banco e os meses em que ele vale. Nascem quando
   * a pessoa importa o razão na etapa Empréstimos e escolhe o banco; nas outras competências, a etapa já sabe quais valem.
   */
  emprestimos?: EmprestimoDaEmpresa[];
  /**
   * quem cuida da empresa no Fiscal e no Contábil (Vitor, 06/10/2026: "o cadastro por responsável"): o nome da pessoa
   * da equipe. Sem = ninguém escolhido (no Fiscal, vale o da planilha do Checklist Folha, que é do Fiscal).
   */
  responsaveis?: Partial<Record<DepartamentoDoResponsavel, string>>;
  /** as transferências de responsável pedidas e ainda não aceitas pelos dois (uma por departamento) */
  transferencias?: Partial<Record<DepartamentoDoResponsavel, TransferenciaDeResponsavel>>;
  /** os parâmetros do DP mudados nas Configurações do DP (o que não está aqui vale o da planilha do DP) */
  dp?: ParametrosDoDp;
  /** os parâmetros do Fiscal mudados em Fiscal › Parâmetros (o que não está aqui vale o da planilha do Fiscal) */
  fiscal?: ParametrosDoFiscal;
  /** a empresa foi cadastrada pelo nads (Vitor, 07/10/2026: "um cadastro de empresas sem o botão de cadastrar empresa"): o regime */
  nova?: { regime: string; criadaEm: string };
  /** as planilhas e os documentos do Fiscal no Drive (os links; Heverton, 20/10/2026) */
  documentosFiscais?: DocumentosDoFiscal;
  /** a alíquota interna e as situações marcadas na antecipação do ICMS do ES (22/10/2026) */
  antecipacaoIcmsEs?: AntecipacaoDoFiscal;
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

/** O segmento da empresa no Fiscal (a planilha junta mais de um: "Comercio / Industria / Serviço"). */
export type SegmentoFiscal = 'comercio' | 'industria' | 'servico';
/** Os parâmetros de sim ou não do Fiscal, na ordem das colunas da planilha do Fiscal (29/10/2026). */
export type ParametroFiscalSimNao = 'monofasico' | 'icmsSt' | 'icmsAntecipacao' | 'icmsDifal' | 'retencoes' | 'beneficioFiscal' | 'parcelamento' | 'declaracoesAdicionais';

/**
 * Os parâmetros do Fiscal de uma empresa (as planilhas "Clientes - Fiscal", da Fabiana e do Heverton, 29/10/2026): o
 * segmento, os de sim ou não e dois textos livres. No Cadastro, só os que foram mudados; o resto vale o da planilha.
 */
export interface ParametrosDoFiscal extends Partial<Record<ParametroFiscalSimNao, boolean>> {
  segmentos?: SegmentoFiscal[];
  especificidades?: string;
  observacoes?: string;
}

export const SEGMENTOS_FISCAIS: readonly { id: SegmentoFiscal; rotulo: string }[] = [
  { id: 'comercio', rotulo: 'Comércio' }, { id: 'industria', rotulo: 'Indústria' }, { id: 'servico', rotulo: 'Serviço' },
];

/** Os de sim ou não, na ordem da planilha, com o nome da coluna dela. */
export const PARAMETROS_FISCAIS: readonly { id: ParametroFiscalSimNao; rotulo: string; descricao: string }[] = [
  { id: 'monofasico', rotulo: 'Monofásico', descricao: 'Vende produto com PIS/COFINS monofásico.' },
  { id: 'icmsSt', rotulo: 'ICMS-ST', descricao: 'Tem ICMS por substituição tributária.' },
  { id: 'icmsAntecipacao', rotulo: 'ICMS-Antecipação', descricao: 'Tem antecipação do ICMS.' },
  { id: 'icmsDifal', rotulo: 'ICMS-DIFAL', descricao: 'Tem diferencial de alíquota do ICMS.' },
  { id: 'retencoes', rotulo: 'Retenções', descricao: 'Tem retenção de impostos nas notas.' },
  { id: 'beneficioFiscal', rotulo: 'Benefício fiscal', descricao: 'Tem benefício fiscal.' },
  { id: 'parcelamento', rotulo: 'Parcelamento', descricao: 'Tem parcelamento de impostos.' },
  { id: 'declaracoesAdicionais', rotulo: 'Declarações adicionais', descricao: 'Entrega declarações além das da rotina.' },
];

/** Tamanho máximo de cada texto livre (Especificidades, Observações). */
export const MAX_TEXTO_DO_FISCAL = 2000;

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

/** Os bancos do relatório de liquidação do Creditor (o Sicoob: Títulos por Período; o Bradesco: Carteira de Cobrança). */
export type BancoDoRelatorio = 'sicoob' | 'bradesco';
export const BANCOS_DO_RELATORIO: readonly { id: BancoDoRelatorio; nome: string }[] = [{ id: 'sicoob', nome: 'Sicoob' }, { id: 'bradesco', nome: 'Bradesco' }];
