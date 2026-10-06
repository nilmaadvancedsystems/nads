// Tipos do Conversor: extrato do banco (PDF, OFX, planilha) → .xls no layout do escritório. Nada é guardado.
// Datas em 'aaaa-mm-dd' e valores em centavos: positivo = entrou no banco, negativo = saiu.

export interface LinhaConvertida {
  /** 'aaaa-mm-dd' */
  data: string;
  /** centavos; + entrada, − saída */
  valor: number;
  historico: string;
}

/** Quem leu o arquivo: o leitor do layout do banco, ou o leitor genérico (o do Extrator). */
export type Leitor = 'banco-do-brasil' | 'generico';

export interface ExtratoConvertido {
  /** o nome do arquivo escolhido */
  arquivo: string;
  /** o banco (o nome da aba do .xls); '' = não deu para saber */
  banco: string;
  leitor: Leitor;
  linhas: LinhaConvertida[];
  /** preenchido quando não deu para aproveitar o arquivo */
  erro: string | null;
}
