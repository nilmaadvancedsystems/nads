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
}

export type TipoEvento = 'inicio' | 'feita' | 'dispensada' | 'interrompida' | 'verificacao-falhou';

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
