// Tarefas por etapas: para cada empresa e competência, o operador faz as etapas da rotina do
// departamento, uma de cada vez, numa tela só. O sistema confere sozinho o que dá para conferir
// (check automático) e, quando a pessoa para, guarda o motivo (a objeção). Tudo vira evento com
// hora e pessoa, para ver produtividade e onde as coisas travam.
import type { Departamento } from '../usuarios/tipos';

/** Como o "Próximo" confere a etapa. */
export type Verificacao =
  /** o Extrator tem extrato do banco com lançamentos na competência */
  | 'extratos'
  /** o Extrator tem extrato e razão do sistema na competência (dá para conferir) */
  | 'extrato-e-sistema'
  /** a pessoa confirma que fez */
  | 'manual';

/** A ferramenta que abre no meio da tela. */
export interface FerramentaDaEtapa {
  /** aplicativo do nads */
  app: 'extratudo' | 'conciliadorzinho' | 'concilia-ai';
  nome: string;
  /** caminho dentro do aplicativo, a partir da empresa (rota = código do ERP) */
  caminho: (rotaEmpresa: string) => string;
  /** false = abre em outra aba (quando não dá para embutir) */
  embutir: boolean;
  /** a ferramenta trabalha vários meses de uma vez (a Etapa com vários meses); sem isso, vai mês a mês */
  periodo?: boolean;
  /** a ferramenta diz à Tarefas o que falta para seguir (a Importação): os botões só aparecem depois que ela disser */
  requisitos?: boolean;
}

/** O que a tela oferece para resolver uma objeção. */
export type Solucao =
  | { tipo: 'contato'; rotulo: string }
  | { tipo: 'drive'; rotulo: string }
  | { tipo: 'orientacao'; rotulo: string; texto: string }
  /** a etapa não se aplica a esta empresa/competência: conta como feita ("dispensada") */
  | { tipo: 'nao-se-aplica'; rotulo: string };

/** Um motivo comum para a etapa não andar. */
/** soMotivo: não vira botão na etapa; só aparece como motivo no Interromper (alimenta a análise do que trava) */
export interface Objecao { id: string; texto: string; solucao: Solucao; soMotivo?: boolean }

export interface Etapa {
  id: string;
  nome: string;
  /** uma linha: o que fazer */
  descricao: string;
  ferramenta: FerramentaDaEtapa | null;
  verificacao: Verificacao;
  objecoes: Objecao[];
  /** o grupo da etapa na barra lateral (Preparação, Ativo, Passivo, Resultado, Fechamento) */
  secao?: string;
  /** o que conferir, item por item (aparece na etapa sem ferramenta, no lugar do "Feito no sistema") */
  conferir?: string[];
  /** o checklist da folha montado pelo balancete importado (Contabilização da Folha): o avançar só com tudo marcado */
  checklistDaFolha?: boolean;
  /** as tarefas da etapa, em ordem (a rotina do Fiscal): marca uma a uma; o avançar só com tudo marcado */
  checklist?: ItemDoChecklist[];
  /** a etapa confere o razão de uma conta: a pessoa importa o XLS da conciliação do Alterdata (conta: "caixa") */
  razao?: { conta: string };
  /**
   * a etapa só entra na rotina do mês quando outra a adiciona (o Creditor, quando o razão do caixa tem liquidação de
   * cobrança); sem isso, não aparece e conta como concluída
   */
  soQuandoAdicionada?: boolean;
  /** a conferência do INSS (razão do INSS a recolher × o PDF das guias pagas) dentro da etapa */
  conferenciaDoInss?: boolean;
}

/** Uma tarefa do checklist da etapa: o texto e, se tiver, os subitens, um link e um aviso. */
export interface ItemDoChecklist {
  id: string;
  texto: string;
  /** o que conferir dentro dela (aparece embaixo, menor) */
  sub?: string[];
  link?: { rotulo: string; url: string };
  /** um cuidado (aparece em destaque embaixo) */
  aviso?: string;
}

export interface Rotina { departamento: Departamento; etapas: Etapa[] }

export type SituacaoEtapa = 'pendente' | 'feita' | 'dispensada' | 'interrompida';

export interface EstadoEtapa {
  situacao: SituacaoEtapa;
  /** quem mexeu por último */
  por: string;
  /** ISO */
  em: string;
  /** interrompida/dispensada: a objeção escolhida */
  objecao?: string;
  observacao?: string;
}

/** A competência de uma empresa num departamento: o estado de cada etapa. */
export interface Execucao {
  empresa: string;
  codigo: number | null;
  /** 'aaaa-mm' */
  competencia: string;
  departamento: Departamento;
  etapas: Record<string, EstadoEtapa>;
  /** os bancos (id) que não tiveram movimento na competência ("Não teve movimento" na linha do banco) */
  semMovimento?: string[];
  /**
   * Vários meses: o período prometido que este mês faz parte ('aaaa-mm..aaaa-mm'). Enquanto estiver aqui,
   * abrir a empresa neste mês leva ao período; só sai quando todos os meses dele estiverem concluídos.
   */
  periodo?: string;
  /** as etapas "só quando adicionada" que entraram neste mês (o Creditor, pelo razão do caixa) */
  adicionadas?: string[];
}

export type TipoEvento = 'inicio' | 'feita' | 'dispensada' | 'interrompida' | 'verificacao-falhou' | 'sem-movimento' | 'com-movimento' | 'reaberta'
  | 'periodo' | 'periodo-encerrado' | 'adicionada' | 'retirada';

/** O que aconteceu, quando e com quem (para produtividade e análise das objeções). */
export interface Evento {
  tipo: TipoEvento;
  etapa: string;
  por: string;
  /** ISO */
  em: string;
  objecao?: string;
  observacao?: string;
}
