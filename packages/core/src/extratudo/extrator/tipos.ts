// Tipos do Extrator (extrato bancário × lançamentos contábeis).
// Datas em 'aaaa-mm-dd' (ordenam como texto) e valores em centavos (inteiros, sem erro de soma):
// positivo = entrou no banco, negativo = saiu.

/** De onde veio o lançamento: o extrato do banco ou o razão da conta no sistema contábil. */
export type Lado = 'banco' | 'sistema';

export interface Lancamento {
  /** 'aaaa-mm-dd' */
  data: string;
  /** centavos; + entrada, − saída */
  valor: number;
  historico: string;
}

/** Um lançamento com endereço: qual arquivo e qual posição dentro dele. */
export interface LancamentoDoArquivo extends Lancamento {
  /** `${idArquivo}:${posição}` */
  id: string;
  idArquivo: string;
  lado: Lado;
}

export type ModoImportacao = 'novas' | 'sobrepor';

/** Um arquivo importado. O arquivo em si (PDF, planilha) nunca é guardado: só os lançamentos lidos. */
export interface ArquivoImportado {
  id: string;
  lado: Lado;
  nome: string;
  /** ISO */
  importadoEm: string;
  /** 'primeira' = não havia nada no período; senão o modo escolhido */
  modo: ModoImportacao | 'primeira';
  lancamentos: Lancamento[];
  /** de qual banco da empresa (id); sem = o primeiro banco dela (arquivos de antes de ter mais de um) */
  banco?: string;
  /** veio do Drive do escritório: o arquivo lá (para o "Visualizar" pedir um link temporário; nada é baixado para guardar) */
  drive?: { id: string; nome: string };
  /** o saldo antes do primeiro lançamento, como o extrato traz (centavos; + credor/positivo na conta) */
  saldoAnterior?: number;
}

/** Um banco que a pessoa adicionou à empresa, valendo da competência "desde" ('aaaa-mm') em diante. */
export interface BancoAdicionado { id: string; nome: string; desde: string; marca?: string; agencia?: string; conta?: string }

export interface RegistroAuditoria {
  /** ISO */
  ts: string;
  acao: string;
  detalhe: string;
  tom: 'ok' | 'bad' | 'neutral';
}

/** Tudo o que o Extrator guarda de uma empresa. */
export interface EmpresaExtrator {
  nome: string;
  arquivos: ArquivoImportado[];
  auditoria: RegistroAuditoria[];
  /** bancos adicionados pela tela (os cadastrados vêm de empresas/bancos.ts) */
  bancos?: BancoAdicionado[];
  /** os pedidos de documentos feitos ao cliente (o histórico do "Pedir extratos"), o mais novo primeiro */
  pedidos?: PedidoRegistrado[];
}

/** Um pedido de documentos ao cliente, como fica no histórico. */
export interface PedidoRegistrado {
  id: string;
  /** ISO */
  em: string;
  /** quem pediu */
  por: string;
  /** 'aaaa-mm' */
  competencias: string[];
  /** o nome de cada documento pedido */
  documentos: string[];
  /** 'dd/mm/aaaa' (vazio = sem prazo) */
  prazo: string;
  email?: { para: string[]; assunto: string; /** os pedidos na fila do robô do Entregas (para ver a situação) */ solicitacoes: string[] };
  whatsapp?: { telefone: string; texto: string };
}

/** Resultado da leitura de um arquivo (antes de importar). */
export interface ArquivoLido {
  nome: string;
  lancamentos: Lancamento[];
  /** o saldo antes do primeiro lançamento, quando o extrato traz (a linha "SALDO ANTERIOR" do PDF; no OFX, o saldo final menos o movimento) */
  saldoAnterior?: number;
  /** preenchido quando não deu para aproveitar o arquivo */
  erro: string | null;
}

export type Situacao = 'ok' | 'faltando' | 'diferente' | 'amais' | 'duplicado';
export type TipoDiferenca = 'data' | 'sinal' | 'valor';

/** Uma linha da conferência: um par extrato × sistema, ou um lado sozinho. */
export interface LinhaConferencia {
  situacao: Situacao;
  extrato: LancamentoDoArquivo | null;
  sistema: LancamentoDoArquivo | null;
  /** o que houve, em português */
  motivo: string;
  tipoDiferenca?: TipoDiferenca;
  /** duplicado: em que lado está a cópia a mais */
  ladoDuplicado?: Lado;
  /** data usada para ordenar (a do extrato quando houver) */
  data: string;
}

export interface Conferencia {
  linhas: LinhaConferencia[];
  /** o sistema veio com os sinais trocados (débito como saída) e foi invertido para comparar */
  sistemaInvertido: boolean;
  contagem: Record<Situacao, number>;
}
