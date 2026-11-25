// Quem pode o quê: cada recurso (aplicativo do nads ou tela do Entregas) diz quais papéis liberam.
// É uma tabela só, para a regra não ficar espalhada pelas telas. Conta desativada não pode nada.
// As linhas do Entregas repetem o que o entregas.html já faz hoje (~L1687-1689, ~L12640-12659,
// nilma-shell.js MODULOS_PADRAO), para os dois sistemas decidirem igual.
// Os aplicativos do nads conferem esta tabela na entrada (tarefas/casca/TravaDeAcesso, 29/10/2026): o Concilia aí, o
// Conciliadorzinho e o Extratudo (Extrator, Cheque especial e Creditor).
import type { Papel, Usuario } from '../tipos';
import { nivelDeDiretor } from './papeis';

/** As contas que só o Diretor e o admin enxergam nas listas da equipe (Vitor, 09/11/2026); são usuários, não setores. */
const CONTAS_RESERVADAS: readonly string[] = ['fiscal.xereta@nilma.local', 'contabil.curioso@nilma.local'];
export const ehContaReservada = (email: string | null | undefined): boolean => CONTAS_RESERVADAS.includes((email || '').trim().toLowerCase());

export type Recurso =
  // aplicativos do nads
  | 'conferencia' | 'cheque-especial' | 'conciliadorzinho' | 'extrator' | 'creditor'
  // gestão
  | 'equipe' | 'auditoria-equipe'
  // telas do Entregas
  | 'entregas-clientes-admin' | 'honorarios' | 'contabil' | 'fiscal-lcdpr' | 'pendencias-arquivo'
  // os prazos (plano do Acessórias, ficha E03): dispensar em lote, mudar o prazo de uma empresa, ver os números da equipe
  | 'prazos-dispensar-lote' | 'prazos-ajustar' | 'indicadores-equipe';

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
  'prazos-dispensar-lote': [],
  'prazos-ajustar': [],
  'indicadores-equipe': [],
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

/**
 * Os recursos dos prazos (ficha E03): como `pode`, mas o Diretor e o Dono (pelo nível) também podem, mesmo sem o papel
 * admin; é assim que o resto do app trata o Diretor (ehDiretor em tarefas/casca/navegacao.ts).
 */
export function podeNosPrazos(u: Pick<Usuario, 'papeis' | 'ativo' | 'nivel'>, recurso: Recurso): boolean {
  return !!u.ativo && (pode(u, recurso) || nivelDeDiretor(u.nivel));
}

/**
 * Pode dispensar uma etapa? Uma por vez, qualquer membro ativo (com motivo: é o "Não se aplica" de hoje); em lote, só quem
 * pode 'prazos-dispensar-lote' (o Diretor, o Dono e o admin). A confirmar com o dono: o Sênior também dispensa em lote?
 */
export function podeDispensar(u: Pick<Usuario, 'papeis' | 'ativo' | 'nivel'>, emLote: boolean): 'nao' | 'com-motivo' {
  if (!u.ativo) return 'nao';
  return !emLote || podeNosPrazos(u, 'prazos-dispensar-lote') ? 'com-motivo' : 'nao';
}
