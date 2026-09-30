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
export type CampoContaPadrao = 'banco' | 'juros' | 'desconto' | 'histPrincipal' | 'histJuros' | 'histDesconto';
/** As que são contas do plano (os históricos não são). */
export type ContaPadraoDoPlano = 'banco' | 'juros' | 'desconto';

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

export interface CadastroDaEmpresa {
  nome: string;
  codigo: number | null;
  /** null = os bancos nunca foram cadastrados (os aplicativos seguem com o que tinham antes) */
  bancos: ContaBancaria[] | null;
  /** null = as contas padrão nunca foram cadastradas (o Creditor segue com as que ele salvou) */
  contasPadrao: ContasPadrao | null;
  historico: RegistroCadastro[];
  atualizadoEm?: string;
}
