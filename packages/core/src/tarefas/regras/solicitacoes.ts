// As solicitações de reunião (Vitor, 13/11/2026, as Notificações do Início novo: "quem é Senior, Diretor, Dono, pode marcar
// uma reunião. O senior, ele vai mandar uma solicitação, onde quem é diretor e dono, vai poder aprovar ou não, podendo colocar
// a obervação"). O Sênior pede; o Diretor e o Dono aprovam (a reunião vira um comunicado das Notificações) ou recusam, com a
// observação; eles mesmos marcam a reunião direto, sem pedir.
import type { Nivel } from '../../usuarios/tipos';
import { nivelDeDiretor } from '../../usuarios/regras/papeis';
import { problemaDoComunicado, type ExtrasDoComunicado } from './inicio';

export type SituacaoDaSolicitacao = 'pendente' | 'aprovada' | 'recusada';

export interface SolicitacaoDeReuniao {
  id: string;
  titulo: string;
  /** a pauta */
  texto: string;
  /** o dia e a hora pedidos, 'aaaa-mm-ddThh:mm' */
  quando: string;
  link?: string;
  /** quem pediu (o nome e o login) e quando */
  por: string;
  porUid: string;
  em: string;
  situacao: SituacaoDaSolicitacao;
  decididoPor?: string;
  decididoEm?: string;
  /** a observação de quem decidiu (opcional) */
  observacao?: string;
}

/** O que a pessoa faz nas Notificações pelo nível: o Sênior pede, o Diretor e o Dono aprovam e marcam direto, os outros nada. */
export type PapelNasSolicitacoes = 'pede' | 'aprova' | 'nenhum';
export function papelNasSolicitacoes(nivel: Nivel | null | undefined): PapelNasSolicitacoes {
  if (nivelDeDiretor(nivel)) return 'aprova';
  return nivel === 'senior' ? 'pede' : 'nenhum';
}

export const ROTULO_DA_SITUACAO: Record<SituacaoDaSolicitacao, string> = { pendente: 'Aguardando', aprovada: 'Aprovada', recusada: 'Recusada' };
export const MAIOR_OBSERVACAO = 500;

/** O que impede de pedir a reunião ('' quando pode): o título, a pauta, o dia e a hora, e o link se tiver. */
export function problemaDaSolicitacao(x: Pick<SolicitacaoDeReuniao, 'titulo' | 'texto' | 'quando'> & { link?: string }): string {
  if (!x.titulo.trim()) return 'Dê um título para a reunião.';
  const extras: ExtrasDoComunicado = { tipo: 'reuniao', titulo: x.titulo, link: x.link || '', quando: x.quando };
  return problemaDoComunicado(x.texto, extras);
}

/** A solicitação decidida (aprovada ou recusada), com quem, quando e a observação (sem observação, o campo não entra). */
export function decidir(s: SolicitacaoDeReuniao, aprovar: boolean, observacao: string, por: string, em: string): SolicitacaoDeReuniao {
  const obs = observacao.trim().slice(0, MAIOR_OBSERVACAO);
  return { ...s, situacao: aprovar ? 'aprovada' : 'recusada', decididoPor: por, decididoEm: em, ...(obs ? { observacao: obs } : {}) };
}

/** A reunião aprovada como comunicado das Notificações (o tipo, o título, o link e o dia). */
export const comunicadoDaReuniao = (s: SolicitacaoDeReuniao): ExtrasDoComunicado => ({ tipo: 'reuniao', titulo: s.titulo, link: s.link || '', quando: s.quando });

/** A ordem da lista: as pendentes em cima; em cada grupo, a mais nova primeiro. */
export function ordenarSolicitacoes<T extends Pick<SolicitacaoDeReuniao, 'situacao' | 'em'>>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => Number(b.situacao === 'pendente') - Number(a.situacao === 'pendente') || b.em.localeCompare(a.em));
}
