// Quem pode o quê: cada recurso (aplicativo do nads ou tela do Entregas) diz quais papéis liberam.
// É uma tabela só, para a regra não ficar espalhada pelas telas. Conta desativada não pode nada.
// As linhas do Entregas repetem o que o entregas.html já faz hoje (~L1687-1689, ~L12640-12659,
// nilma-shell.js MODULOS_PADRAO), para os dois sistemas decidirem igual.
// Os aplicativos do nads conferem esta tabela na entrada (tarefas/casca/TravaDeAcesso, 29/10/2026): o Concilia aí, o
// Conciliadorzinho e o Extratudo (Extrator, Cheque especial e Creditor).
import type { Papel, Usuario } from '../tipos';

export type Recurso =
  // aplicativos do nads
  | 'conferencia' | 'cheque-especial' | 'conciliadorzinho' | 'extrator' | 'creditor'
  // gestão
  | 'equipe' | 'auditoria-equipe'
  // telas do Entregas
  | 'entregas-clientes-admin' | 'honorarios' | 'contabil' | 'fiscal-lcdpr' | 'pendencias-arquivo';

/** Papéis que liberam cada recurso ('admin' libera tudo, como no Entregas). */
export const ACESSO: Readonly<Record<Recurso, readonly Papel[]>> = {
  conferencia: ['contabil'],
  'cheque-especial': ['contabil'],
  conciliadorzinho: ['contabil'],
  extrator: ['contabil'],
  creditor: ['contabil'],
  equipe: [],
  'auditoria-equipe': [],
  'entregas-clientes-admin': [],
  honorarios: ['office_boy'],
  contabil: ['contabil'],
  'fiscal-lcdpr': ['fiscal'],
  'pendencias-arquivo': ['contabil'],
};

/** A pessoa pode usar o recurso? Admin pode tudo; conta desativada, nada. */
export function pode(u: Pick<Usuario, 'papeis' | 'ativo'>, recurso: Recurso): boolean {
  if (!u.ativo) return false;
  if (u.papeis.includes('admin')) return true;
  return ACESSO[recurso].some(p => u.papeis.includes(p));
}

/** Pode usar pelo menos um dos recursos? (um aplicativo com várias ferramentas, como o Extratudo) */
export function podeAlgum(u: Pick<Usuario, 'papeis' | 'ativo'>, recursos: readonly Recurso[]): boolean {
  return recursos.some(r => pode(u, r));
}

/** Os recursos que a pessoa pode usar, na ordem da tabela (ex.: para montar o menu). */
export function recursosDe(u: Pick<Usuario, 'papeis' | 'ativo'>): Recurso[] {
  return (Object.keys(ACESSO) as Recurso[]).filter(r => pode(u, r));
}
