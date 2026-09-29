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
}

/** Resultado da leitura de um arquivo (antes de importar). */
export interface ArquivoLido {
  nome: string;
  lancamentos: Lancamento[];
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
