// Tipos do Lançatudo (17/11/2026: "desenvolver um Mister dentro do nads"): cada linha do extrato que o Extrator já leu
// vira um lançamento contábil pronto para importar no Alterdata — a conta do banco de um lado e a contrapartida do outro.
// A contrapartida vem, nesta ordem: o que a pessoa escolheu na linha, uma regra da empresa, a conta que o nads aprendeu
// para aquele favorecido, ou a sugestão pelo razão já importado (só sugestão: a pessoa confirma).
// Datas em 'aaaa-mm-dd' e valores em centavos (+ entrou no banco, − saiu), como no Extrator.

/** Em que sentido a regra vale: o que entrou no banco, o que saiu, ou os dois. */
export type SentidoDaRegra = 'entrada' | 'saida' | 'ambos';

/**
 * Como a regra procura no histórico do banco: 'historico' = o texto da expressão ("TARIFA COBRANCA", com * para
 * qualquer coisa no meio); 'favorecido' = o nome ou o CPF/CNPJ de quem pagou ou recebeu (o histórico tem de ter todas
 * as palavras do nome, em qualquer ordem, ou os dígitos do documento).
 */
export type TipoDaRegra = 'historico' | 'favorecido';

export interface RegraDoLancatudo {
  id: string;
  /** o nome que aparece na lista ("Tarifas do Sicoob"); sem = a expressão */
  descricao?: string;
  tipo: TipoDaRegra;
  expressao: string;
  sentido: SentidoDaRegra;
  /** o código reduzido da contrapartida no plano */
  conta: string;
  /** só nesta conta bancária (o id do Cadastro); sem = em todas */
  banco?: string;
  /** o texto do histórico do lançamento (vazio = só o do extrato) */
  historico?: string;
  /** junta o histórico do extrato depois do texto (sem texto, vai sempre o do extrato) */
  comHistoricoDoExtrato: boolean;
  /** o código do histórico no Alterdata (só dígitos) */
  codHistorico?: string;
  /** ISO */
  criadaEm: string;
  /** quem criou (fica mesmo depois de alterada) */
  por: string;
  /** a última alteração (ISO e quem) */
  alteradaEm?: string;
  alteradaPor?: string;
}

/** A conta que o nads aprendeu para um favorecido (quando a pessoa escolheu a conta numa linha). */
export interface ContaLembrada { conta: string; /** o texto de onde saiu a chave, para mostrar */ exemplo: string; em: string; por: string }

/** O que é da empresa e vale em todo mês: as regras e o que foi aprendido. */
export interface ConfigDoLancatudo {
  regras: RegraDoLancatudo[];
  /** chave do favorecido com o sentido ('e:' entrada / 's:' saída) → a conta */
  lembradas: Record<string, ContaLembrada>;
}

/** O que a pessoa decidiu numa linha (vale mais que regra e aprendizado). */
export interface DecisaoDaLinha {
  /** a contrapartida escolhida; '' = tirou a conta (a linha volta a ficar sem conta, mesmo com regra) */
  conta?: string;
  /** o histórico final, quando a pessoa editou */
  historico?: string;
  /** o código do histórico padrão no Alterdata, quando a pessoa escolheu na linha ('' = sem código, mesmo com regra) */
  codHistorico?: string;
  /** o número do documento (vai na coluna Nota do arquivo do Alterdata) */
  documento?: string;
  /** a linha fica fora da exportação (já lançada de outro jeito) */
  ignorar?: boolean;
  em: string;
  por: string;
}

/** Uma exportação feita (o registro de quem exportou o quê). */
export interface ExportacaoFeita {
  em: string;
  por: string;
  banco: string;
  /** quantos lançamentos foram */
  quantidade: number;
  /** 'arquivo' = baixou o .xls; 'alterdata' = pediu ao robô para importar; 'conferencia' = a Simples Conferência */
  destino: 'arquivo' | 'alterdata' | 'conferencia';
}

/** O mês da empresa: as decisões de cada banco (pela chave da linha) e as exportações. */
export interface MesDoLancatudo {
  competencia: string;
  decisoes: Record<string, Record<string, DecisaoDaLinha>>;
  exportacoes: ExportacaoFeita[];
}

/** De onde veio a contrapartida da linha. */
/**
 * 'lancada' = a conta que já está no razão do mês (18/11/2026: "ele tem que ler a razão para auxiliar a achar as contas… procurar
 * valores em dias iguais e verificar a conta do cliente"): o mesmo valor no mesmo dia, com a contrapartida que o Alterdata tem.
 */
export type OrigemDaConta = 'pessoa' | 'regra' | 'lembrada' | 'razao' | 'lancada';

/**
 * A situação da linha: 'conciliada' = tem contrapartida certa (pela pessoa, por regra ou aprendida); 'sugerida' = só a
 * sugestão pelo razão (a pessoa confirma); 'pendente' = sem conta; 'ignorada' = fora da exportação; 'no-razao' = já
 * está no razão importado do mês (já foi lançada no Alterdata).
 */
export type SituacaoDaLinha = 'conciliada' | 'sugerida' | 'pendente' | 'ignorada' | 'no-razao';

/** Uma linha do Registro: o lançamento do extrato com a contrapartida. */
export interface LinhaDoRegistro {
  /** a chave estável da linha (sobrevive à releitura do extrato): dia, valor, histórico e a ocorrência */
  chave: string;
  data: string;
  /** centavos; + entrou, − saiu */
  valor: number;
  historicoDoBanco: string;
  /** o histórico que vai no lançamento */
  historico: string;
  codHistorico: string;
  /** o documento (vazio = sem) */
  documento: string;
  contaDoBanco: string;
  /** a contrapartida; null = sem conta */
  conta: string | null;
  nomeDaConta: string;
  origem: OrigemDaConta | null;
  /** a pessoa mexeu na conta desta linha (escolheu ou tirou): dá para voltar ao automático */
  contaEscolhida?: boolean;
  /** a regra que deu a conta */
  regra?: string;
  situacao: SituacaoDaLinha;
  /** o que está errado na conta (não existe no plano, é sintética) */
  problema?: string;
}

/** Os números do mês do banco. */
export interface TotaisDoRegistro {
  linhas: number;
  conciliadas: number;
  sugeridas: number;
  pendentes: number;
  ignoradas: number;
  noRazao: number;
  /** centavos */
  entradas: number;
  saidas: number;
}
