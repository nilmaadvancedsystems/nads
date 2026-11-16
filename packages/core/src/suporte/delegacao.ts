// Delegar uma solicitação dos Feedbacks (16/11/2026): quem abre a solicitação passa para alguém da equipe com o papel
// 'desenvolvedor' (o mesmo que liga o modo desenvolvedor). Grava para quem foi, quem passou e quando; a janela mostra
// "Delegada a Fulano". TypeScript puro: quem chama lê a equipe e grava no banco.
import { ehContaReservada } from '../usuarios/regras/acesso';
import type { Usuario } from '../usuarios/tipos';

/** A delegação gravada no feedback (o campo `delegacao`). */
export interface DelegacaoDoFeedback {
  /** o uid de quem recebeu */
  uid: string;
  /** o nome de quem recebeu, como estava ao delegar */
  nome: string;
  /** quem passou (o nome) */
  por: string;
  /** quando (ISO) */
  em: string;
}

/** O nome de quem recebe e de quem passou vai com no máximo este tanto de letras (a regra do banco confere o mesmo). */
export const NOME_MAXIMO = 120;

/**
 * Quem pode receber: as pessoas ativas com o papel 'desenvolvedor', em ordem de nome. As contas reservadas (as de
 * consulta, como fiscal.xereta) ficam de fora.
 */
export function quemRecebeOFeedback(equipe: readonly Pick<Usuario, 'uid' | 'nome' | 'email' | 'ativo' | 'papeis'>[]): { uid: string; nome: string }[] {
  return equipe
    .filter(u => u.ativo && u.papeis.includes('desenvolvedor') && !ehContaReservada(u.email) && u.nome.trim())
    .map(u => ({ uid: u.uid, nome: u.nome.trim() }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** A delegação nova, pronta para gravar. Erra se a pessoa não está entre quem pode receber. */
export function delegacaoNova(
  para: { uid: string; nome: string },
  podem: readonly { uid: string }[],
  por: string,
  agora: Date,
): DelegacaoDoFeedback {
  if (!para.uid || !podem.some(p => p.uid === para.uid)) throw new Error('Essa pessoa não tem a função de desenvolvedor.');
  return { uid: para.uid, nome: para.nome.trim().slice(0, NOME_MAXIMO), por: por.trim().slice(0, NOME_MAXIMO), em: agora.toISOString() };
}

/** A delegação lida do banco (o que não tiver uid e nome vira null: não delegada). */
export function lerDelegacao(v: unknown): DelegacaoDoFeedback | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>;
  const s = (k: string) => (typeof x[k] === 'string' ? (x[k] as string) : '');
  if (!s('uid') || !s('nome')) return null;
  return { uid: s('uid'), nome: s('nome'), por: s('por'), em: s('em') };
}

/** O texto da janela: "Delegada a Fulano", com quem passou e quando, se tiver. */
export function textoDaDelegacao(d: DelegacaoDoFeedback | null): { titulo: string; detalhe: string } | null {
  if (!d) return null;
  const quando = d.em && !Number.isNaN(Date.parse(d.em))
    ? new Date(d.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '';
  const detalhe = [d.por ? 'por ' + d.por : '', quando ? 'em ' + quando : ''].filter(Boolean).join(' ');
  return { titulo: 'Delegada a ' + d.nome, detalhe };
}
