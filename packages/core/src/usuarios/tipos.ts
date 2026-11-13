// Usuários da Nilma: quem é a pessoa (departamento e nível) e o que ela pode fazer (papéis).
// O documento é o MESMO de usuarios/{uid} do Entregas (projeto entregas-2e5e2): os campos que o
// Entregas já usa continuam iguais, e entram só departamento, nivel e ativo. Todos os sistemas do
// Entregas conferem `roles`, então é `roles` que carrega o acesso — ver regras/papeis.ts.

/** Os três departamentos do funil: Fiscal → Departamento Pessoal → Contábil. */
export type Departamento = 'fiscal' | 'dp' | 'contabil';

/** Nível na carreira, do mais alto ao mais baixo. */
export type Nivel = 'dono' | 'diretor' | 'senior' | 'pleno' | 'junior';

/**
 * Papéis que os sistemas do Entregas conferem (temPapel). 'staff' é o piso de quem tem conta;
 * 'dp' é o do Departamento Pessoal (a Tarefas já rotula).
 */
/** 'financeiro': autoriza quem não é Diretor a ver o Financeiro do nads; só o Diretor dá (09/11/2026). 'desenvolvedor': quem pode ligar o modo desenvolvedor (Vitor, 06/11/2026: "apenas para quem tá desenvolvendo"). */
export type Papel = 'staff' | 'admin' | 'contabil' | 'fiscal' | 'dp' | 'office_boy' | 'equipe_geral' | 'desenvolvedor' | 'financeiro';

/** usuarios/{uid} como está gravado (campos do Entregas + os novos, todos opcionais na leitura). */
export interface DocUsuario {
  /** o nome de usuário: é o login de quem entra pelo nome (único na equipe) */
  nome?: string;
  /** o sobrenome (Vitor, 12/11/2026: "pede nome e sobrenome no cadastro"); as contas antigas não têm até alguém completar */
  sobrenome?: string;
  email?: string;
  roles?: string[];
  /** legado: papel único, antes de existir `roles` */
  role?: string;
  criadoEm?: string;
  fotoPerfil?: string;
  /** o aniversário ('aaaa-mm-dd', 'mm-dd' ou 'dd/mm'): a saudação do Início novo (13/11/2026; as datas o Vitor manda depois) */
  aniversario?: string;
  departamento?: string;
  nivel?: string;
  /** false = desativado (o Entregas já lê este campo na Tarefas e nos robôs) */
  ativo?: boolean;
  /** a última vez que o nads (a Tarefas) desta pessoa estava aberto (ISO; o próprio nads grava a cada 3 min) */
  nadsVistoEm?: string;
  /** a empresa e a etapa do Contábil abertas agora (o próprio nads grava; sai ao deixar a etapa) */
  nadsOnde?: Partial<OndeNoNads>;
}

/** Onde a pessoa está trabalhando no Contábil (Vitor, 09/11/2026): a empresa, a etapa, o período e quando foi o último sinal (ISO). */
export interface OndeNoNads { codigo: number | null; empresa: string; etapa: string; competencia: string; em: string }

/** A pessoa já lida e conferida, pronta para as telas. */
export interface Usuario {
  uid: string;
  nome: string;
  /** '' nas contas antigas, até completar */
  sobrenome?: string;
  email: string;
  departamento: Departamento | null;
  nivel: Nivel | null;
  /** todos os papéis (os do departamento/nível + os dados à mão, como office_boy) */
  papeis: Papel[];
  ativo: boolean;
  fotoPerfil: string | null;
  /** a última vez que o nads dela estava aberto (ISO), ou null se nunca abriu */
  vistoNoNads?: string | null;
  /** a empresa e a etapa do Contábil em que ela está (null = em nenhuma) */
  ondeNoNads?: OndeNoNads | null;
}
