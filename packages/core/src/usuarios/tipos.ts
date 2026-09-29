// Usuários da Nilma: quem é a pessoa (departamento e nível) e o que ela pode fazer (papéis).
// O documento é o MESMO de usuarios/{uid} do Entregas (projeto entregas-2e5e2): os campos que o
// Entregas já usa continuam iguais, e entram só departamento, nivel e ativo. Todos os sistemas do
// Entregas conferem `roles`, então é `roles` que carrega o acesso — ver regras/papeis.ts.

/** Os três departamentos do funil: Fiscal → Departamento Pessoal → Contábil. */
export type Departamento = 'fiscal' | 'dp' | 'contabil';

/** Nível na carreira, do mais alto ao mais baixo. */
export type Nivel = 'diretor' | 'senior' | 'pleno' | 'junior';

/**
 * Papéis que os sistemas do Entregas conferem (temPapel). 'staff' é o piso de quem tem conta;
 * 'dp' é o do Departamento Pessoal (a Tarefas já rotula).
 */
export type Papel = 'staff' | 'admin' | 'contabil' | 'fiscal' | 'dp' | 'office_boy' | 'equipe_geral';

/** usuarios/{uid} como está gravado (campos do Entregas + os novos, todos opcionais na leitura). */
export interface DocUsuario {
  nome?: string;
  email?: string;
  roles?: string[];
  /** legado: papel único, antes de existir `roles` */
  role?: string;
  criadoEm?: string;
  fotoPerfil?: string;
  departamento?: string;
  nivel?: string;
  /** false = desativado (o Entregas já lê este campo na Tarefas e nos robôs) */
  ativo?: boolean;
}

/** A pessoa já lida e conferida, pronta para as telas. */
export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  departamento: Departamento | null;
  nivel: Nivel | null;
  /** todos os papéis (os do departamento/nível + os dados à mão, como office_boy) */
  papeis: Papel[];
  ativo: boolean;
  fotoPerfil: string | null;
}
