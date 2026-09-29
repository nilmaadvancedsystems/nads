// Conta nova e mudanças de cargo: o que conferir antes de gravar e o documento que vai para
// usuarios/{uid}. Mesmas regras do formulário de novo acesso do Entregas (~L12128-12157: nome e
// senha ≥ 6; "Já existe um acesso com esse nome."), mais departamento e nível obrigatórios.
import type { Departamento, DocUsuario, Nivel, Papel } from '../tipos';
import { emailDoNome, SENHA_MINIMA } from './login';
import { ehDepartamento, ehNivel, papeisAoMudarCargo, papeisDaContaNova, papeisDoDoc } from './papeis';

export interface NovaConta {
  nome: string;
  senha: string;
  departamento: Departamento | '';
  nivel: Nivel | '';
  /** papéis marcados à mão (Office boy, Equipe geral…) */
  extras?: Papel[];
}

/** O que está errado (vazio = pode criar). `emailsExistentes`: os e-mails de login já usados. */
export function conferirNovaConta(c: NovaConta, emailsExistentes: readonly string[]): string[] {
  const erros: string[] = [];
  const nome = c.nome.trim().replace(/\s+/g, ' ');
  if (nome.length < 2) erros.push('Escreva o nome da pessoa.');
  if (c.senha.length < SENHA_MINIMA) erros.push('A senha precisa de pelo menos ' + SENHA_MINIMA + ' caracteres.');
  if (!ehDepartamento(c.departamento)) erros.push('Escolha o departamento.');
  if (!ehNivel(c.nivel)) erros.push('Escolha o nível.');
  if (nome.length >= 2 && emailsExistentes.includes(emailDoNome(nome))) erros.push('Já existe um acesso com esse nome.');
  return erros;
}

/** O documento da conta nova (o uid vem da criação no Firebase Auth). */
export function docDaContaNova(c: NovaConta, agora: Date): DocUsuario & { roles: Papel[] } {
  const nome = c.nome.trim().replace(/\s+/g, ' ');
  const departamento = ehDepartamento(c.departamento) ? c.departamento : null;
  const nivel = ehNivel(c.nivel) ? c.nivel : null;
  return {
    nome,
    email: emailDoNome(nome),
    roles: papeisDaContaNova(departamento, nivel, c.extras),
    ...(departamento ? { departamento } : {}),
    ...(nivel ? { nivel } : {}),
    ativo: true,
    criadoEm: agora.toISOString(),
  };
}

/**
 * Os campos que mudam quando o admin troca o departamento e/ou o nível de alguém: os dois campos
 * e os `roles` recalculados (mantendo os papéis dados à mão).
 */
export function mudancaDeCargo(doc: DocUsuario, departamento: Departamento | null, nivel: Nivel | null): Pick<DocUsuario, 'departamento' | 'nivel' | 'roles'> {
  const antes = { departamento: ehDepartamento(doc.departamento) ? doc.departamento : null, nivel: ehNivel(doc.nivel) ? doc.nivel : null };
  return {
    departamento: departamento ?? undefined,
    nivel: nivel ?? undefined,
    roles: papeisAoMudarCargo(papeisDoDoc(doc), antes, { departamento, nivel }),
  };
}
