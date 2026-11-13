// As reuniões das Notificações do Início novo (Vitor, 13/11/2026). Pedida pelo Sênior: Em análise (o pedido) → Revisando (o
// Diretor ou o Dono abriu e deu um prazo de resposta) → Aprovada (aparece para quem vai) ou Recusada → Em andamento (sozinha,
// no dia e na hora) → Finalizada (o Sênior anexou o Problema identificado e a Solução proposta e pede o comentário de quem
// participou) → Concluída (os dois arquivos e o comentário de cada participante) → Encerrada (o Diretor ou o Dono fecha).
// Remarcada quando precisa trocar o dia. Marcada pelo Diretor ou pelo Dono: já aparece para todos, passa por Em andamento e,
// com o Problema e a Solução anexados, cai direto em Encerrada ("como eles sao tomadores de decisao final resolve").
// Só as regras: quem guarda é o repositório (dados/reunioes).
import { nivelDeDiretor } from '../../usuarios/regras/papeis';
import type { Nivel } from '../../usuarios/tipos';
import type { Anexo, Nota, Pessoa } from './delegadas';
import { limparAviso, linkValido, MAIOR_AVISO, MAIOR_TITULO_DO_COMUNICADO } from './inicio';

/** O que fica guardado; Em andamento não é guardado: vem do dia e da hora. */
export type StatusGuardado = 'em-analise' | 'revisando' | 'aprovada' | 'remarcada' | 'recusada' | 'finalizada' | 'concluida' | 'encerrada';
export type StatusDaReuniao = StatusGuardado | 'em-andamento';

export const ROTULO_DO_STATUS: Record<StatusDaReuniao, string> = {
  'em-analise': 'Em análise', revisando: 'Revisando', aprovada: 'Aprovada', remarcada: 'Remarcada', recusada: 'Recusada',
  'em-andamento': 'Em andamento', finalizada: 'Finalizada', concluida: 'Concluída', encerrada: 'Encerrada',
};
/** a cor do selo de cada status (os tons dos selos do nads) */
export const TOM_DO_STATUS: Record<StatusDaReuniao, 'warn' | 'info' | 'ok' | 'neutral' | 'bad'> = {
  'em-analise': 'warn', revisando: 'warn', aprovada: 'info', remarcada: 'info', recusada: 'neutral',
  'em-andamento': 'info', finalizada: 'warn', concluida: 'ok', encerrada: 'ok',
};

export interface ComentarioDaReuniao { uid: string; nome: string; texto: string; em: string }
/** a presença de um convidado (Vitor, 13/11/2026: "Os colaboradores convidados para reuniao devem confirmar a presença") */
export interface PresencaNaReuniao { uid: string; nome: string; vai: boolean; em: string }

export interface Reuniao {
  id: string;
  titulo: string;
  pauta: string;
  /** o dia e a hora, 'aaaa-mm-ddThh:mm' */
  quando: string;
  link?: string;
  criadaPor: Pessoa;
  /** pedida pelo Sênior (passa pela aprovação) ou marcada direto pelo Diretor ou pelo Dono */
  origem: 'pedido' | 'direta';
  /** quem vai (sem quem criou): só eles comentam */
  participantes: Pessoa[];
  /** da equipe (sem isto) ou LIVE (só a LIVE tem link) e quanto tempo dura, em minutos */
  tipo?: TipoDaReuniao;
  duracao?: number;
  /** o Diretor ou o Dono participa (o sistema descobre pelo nível dos convidados: comDiretorEntre) */
  comDiretor: boolean;
  status: StatusGuardado;
  /** Revisando: até quando o Diretor responde ('aaaa-mm-dd') */
  prazoDaRevisao?: string;
  decididoPor?: string;
  /** a observação de quem aprovou ou a justificativa de quem recusou (obrigatória na recusa) */
  observacao?: string;
  problema?: Anexo;
  solucao?: Anexo;
  comentarios: ComentarioDaReuniao[];
  /** quem já respondeu se vai (Vou / Não vou) */
  presencas: PresencaNaReuniao[];
  historico: Nota[];
  em: string;
}

/** O que a pessoa faz pelo nível: o Sênior pede, o Diretor e o Dono decidem e marcam direto, os outros participam. */
export type Papel = 'pede' | 'aprova' | 'participa';
export function papelPeloNivel(nivel: Nivel | null | undefined): Papel {
  if (nivelDeDiretor(nivel)) return 'aprova';
  return nivel === 'senior' ? 'pede' : 'participa';
}

/** O status de agora: a aprovada (ou remarcada) cujo dia e hora já chegaram está Em andamento. agora: 'aaaa-mm-ddThh:mm'. */
export function statusDaReuniao(r: Pick<Reuniao, 'status' | 'quando'>, agora: string): StatusDaReuniao {
  if ((r.status === 'aprovada' || r.status === 'remarcada') && r.quando && agora >= r.quando) return 'em-andamento';
  return r.status;
}

/** Quem vê a reunião: a marcada direto, todos; a pedida, quem pediu, quem vai e o Diretor e o Dono. */
export function ve(r: Pick<Reuniao, 'origem' | 'criadaPor' | 'participantes'>, uid: string, aprova: boolean): boolean {
  return r.origem === 'direta' || aprova || r.criadaPor.uid === uid || r.participantes.some(p => p.uid === uid);
}

/** Quem é o responsável por finalizar (anexar o Problema e a Solução): quem criou. */
export const responsavel = (r: Pick<Reuniao, 'criadaPor'>, uid: string) => r.criadaPor.uid === uid;

/** Os participantes que ainda não comentaram. */
export const faltaComentar = (r: Pick<Reuniao, 'participantes' | 'comentarios'>): Pessoa[] => r.participantes.filter(p => !r.comentarios.some(c => c.uid === p.uid));

/** Quem foi convidado e ainda não respondeu se vai. */
export const semResposta = (r: Pick<Reuniao, 'participantes' | 'presencas'>): Pessoa[] => r.participantes.filter(p => !r.presencas.some(x => x.uid === p.uid));

export type AcaoDaReuniao = 'revisar' | 'aprovar' | 'recusar' | 'remarcar' | 'confirmar' | 'anexar' | 'finalizar' | 'comentar' | 'encerrar';

/** O que a pessoa pode fazer na reunião agora. */
export function acoes(r: Reuniao, quem: { uid: string; aprova: boolean }, agora: string): AcaoDaReuniao[] {
  const s = statusDaReuniao(r, agora);
  const dono = responsavel(r, quem.uid) || (r.origem === 'direta' && quem.aprova);
  const a: AcaoDaReuniao[] = [];
  if (quem.aprova && r.origem === 'pedido' && (s === 'em-analise' || s === 'revisando')) a.push(...(s === 'em-analise' ? ['revisar' as const] : []), 'aprovar', 'recusar');
  if ((dono || quem.aprova) && (s === 'aprovada' || s === 'remarcada' || s === 'em-andamento')) a.push('remarcar');
  // o convidado responde se vai até a reunião começar (e pode mudar a resposta)
  if ((s === 'aprovada' || s === 'remarcada') && r.participantes.some(p => p.uid === quem.uid)) a.push('confirmar');
  if (dono && s === 'em-andamento') a.push('anexar', ...(r.problema && r.solucao ? ['finalizar' as const] : []));
  if (s === 'finalizada' && r.participantes.some(p => p.uid === quem.uid) && !r.comentarios.some(c => c.uid === quem.uid)) a.push('comentar');
  if (quem.aprova && s === 'concluida') a.push('encerrar');
  return a;
}

// ---------------------------------------------------------------------------------------------------------------------
// pedir e marcar
// ---------------------------------------------------------------------------------------------------------------------

export interface PedidoDeReuniao { titulo: string; pauta: string; quando: string; link: string; participantes: Pessoa[]; comDiretor: boolean; tipo: TipoDaReuniao; duracao: number }

/** Vitor, 13/11/2026: "Tipo: Reunião da Equipe e LIVE / Dia e hora / link apenas se for LIVE". */
export type TipoDaReuniao = 'equipe' | 'live';
export const TIPOS_DA_REUNIAO: readonly { valor: TipoDaReuniao; rotulo: string }[] = [{ valor: 'equipe', rotulo: 'Reunião da equipe' }, { valor: 'live', rotulo: 'LIVE' }];
export const rotuloDoTipoDaReuniao = (t: TipoDaReuniao | undefined) => (t === 'live' ? 'LIVE' : 'Reunião da equipe');

/** As durações do menu, em minutos ("Coloca duração, faltou no formulario do senior"). */
export const DURACOES = [15, 30, 45, 60, 90, 120] as const;
export function rotuloDaDuracao(min: number | undefined): string {
  if (!min) return '';
  const h = Math.floor(min / 60), m = min % 60;
  return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m + ' min';
}

/** Algum convidado é Diretor ou Dono? (Vitor, 13/11/2026: sem a caixinha, "o sistema vai identificar a hierarquia de cada um") */
export function comDiretorEntre(participantes: Pick<Pessoa, 'uid'>[], equipe: { uid: string; nivel: Nivel | null }[]): boolean {
  return participantes.some(p => nivelDeDiretor(equipe.find(u => u.uid === p.uid)?.nivel));
}

/** O que impede de pedir (ou marcar) a reunião ('' quando pode). */
export function problemaDoPedido(p: PedidoDeReuniao): string {
  const titulo = p.titulo.trim();
  if (!titulo) return 'Dê um título para a reunião.';
  if (titulo.length > MAIOR_TITULO_DO_COMUNICADO) return 'O título passou de ' + MAIOR_TITULO_DO_COMUNICADO + ' caracteres.';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(p.quando)) return 'Escolha o dia e a hora da reunião.';
  if (!p.duracao || p.duracao <= 0) return 'Escolha a duração.';
  if (p.tipo === 'live' && !p.link.trim()) return 'Ponha o link da LIVE.';
  if (p.tipo === 'live' && !linkValido(p.link.trim())) return 'O link precisa começar com https://';
  const pauta = limparAviso(p.pauta);
  if (!pauta) return 'Escreva a pauta.';
  if (pauta.length > MAIOR_AVISO) return 'A pauta passou de ' + MAIOR_AVISO + ' caracteres.';
  return '';
}

const nota = (por: string, em: string, texto: string): Nota => ({ por, em, texto });

/** A reunião nova: a do Sênior entra Em análise; a do Diretor ou do Dono já entra Aprovada (aparece para todos). */
export function nova(p: PedidoDeReuniao, o: { id: string; por: Pessoa; em: string; direta: boolean }): Reuniao {
  return {
    id: o.id, titulo: p.titulo.trim(), pauta: limparAviso(p.pauta), quando: p.quando, ...(p.tipo === 'live' && p.link.trim() ? { link: p.link.trim(), tipo: 'live' as const } : {}),
    ...(p.duracao > 0 ? { duracao: p.duracao } : {}),
    criadaPor: o.por, origem: o.direta ? 'direta' : 'pedido', participantes: p.participantes.filter(x => x.uid !== o.por.uid), comDiretor: o.direta || p.comDiretor,
    status: o.direta ? 'aprovada' : 'em-analise', comentarios: [], presencas: [], historico: [nota(o.por.nome, o.em, o.direta ? 'Marcou a reunião' : 'Pediu a reunião')], em: o.em,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// as passagens (cada uma devolve a reunião nova; o repositório grava)
// ---------------------------------------------------------------------------------------------------------------------

export const MAIOR_COMENTARIO = 1000;
export const MAIOR_OBSERVACAO = 500;

export function revisar(r: Reuniao, prazo: string, por: string, em: string): Reuniao {
  return { ...r, status: 'revisando', prazoDaRevisao: prazo, historico: [...r.historico, nota(por, em, 'Abriu para revisar, com resposta até ' + prazo.split('-').reverse().join('/'))] };
}

/** A recusa pede a justificativa (Vitor, 13/11/2026: "Tem que ter justificativa da recusa… Para que o senior saiba"). */
export const problemaDaRecusa = (justificativa: string) => (justificativa.trim() ? '' : 'Escreva a justificativa da recusa.');

export function decidir(r: Reuniao, aprovar: boolean, observacao: string, por: string, em: string): Reuniao {
  if (!aprovar && problemaDaRecusa(observacao)) throw new Error(problemaDaRecusa(observacao));
  const obs = observacao.trim().slice(0, MAIOR_OBSERVACAO);
  const { prazoDaRevisao: _p, ...resto } = r;
  return { ...resto, status: aprovar ? 'aprovada' : 'recusada', decididoPor: por, ...(obs ? { observacao: obs } : {}), historico: [...r.historico, nota(por, em, aprovar ? 'Aprovou a reunião' : 'Recusou a reunião')] };
}

export function remarcar(r: Reuniao, quando: string, por: string, em: string): Reuniao {
  return { ...r, quando, status: 'remarcada', historico: [...r.historico, nota(por, em, 'Remarcou para ' + quando.slice(0, 10).split('-').reverse().join('/') + ' ' + quando.slice(11))] };
}

export function anexar(r: Reuniao, qual: 'problema' | 'solucao', a: Anexo, por: string, em: string): Reuniao {
  return { ...r, [qual]: a, historico: [...r.historico, nota(por, em, (qual === 'problema' ? 'Anexou o Problema identificado: ' : 'Anexou a Solução proposta: ') + a.nome)] };
}

/**
 * Finaliza: a marcada direto (o Diretor ou o Dono) cai direto em Encerrada; a pedida fica Finalizada, esperando o comentário
 * de quem participou (sem participante, já fica Concluída).
 */
export function finalizar(r: Reuniao, por: string, em: string): Reuniao {
  if (!r.problema || !r.solucao) throw new Error('Anexe o Problema identificado e a Solução proposta.');
  const status: StatusGuardado = r.origem === 'direta' ? 'encerrada' : faltaComentar(r).length ? 'finalizada' : 'concluida';
  return { ...r, status, historico: [...r.historico, nota(por, em, r.origem === 'direta' ? 'Finalizou e encerrou a reunião' : 'Finalizou a reunião e pediu os comentários')] };
}

/** A resposta do convidado (Vou / Não vou); responder de novo troca a resposta. */
export function confirmarPresenca(r: Reuniao, quem: Pessoa, vai: boolean, em: string): Reuniao {
  if (!r.participantes.some(p => p.uid === quem.uid)) throw new Error('Só quem foi convidado confirma a presença.');
  return { ...r, presencas: [...r.presencas.filter(x => x.uid !== quem.uid), { uid: quem.uid, nome: quem.nome, vai, em }], historico: [...r.historico, nota(quem.nome, em, vai ? 'Confirmou a presença' : 'Avisou que não vai')] };
}

/** O comentário de um participante; com todos, a reunião fica Concluída. */
export function comentar(r: Reuniao, quem: Pessoa, texto: string, em: string): Reuniao {
  const t = limparAviso(texto).slice(0, MAIOR_COMENTARIO);
  if (!t) throw new Error('Escreva o que achou da reunião.');
  const comentarios = [...r.comentarios.filter(c => c.uid !== quem.uid), { uid: quem.uid, nome: quem.nome, texto: t, em }];
  const depois = { ...r, comentarios };
  return { ...depois, status: r.status === 'finalizada' && !faltaComentar(depois).length ? 'concluida' : r.status, historico: [...r.historico, nota(quem.nome, em, 'Comentou a reunião')] };
}

export function encerrar(r: Reuniao, por: string, em: string): Reuniao {
  return { ...r, status: 'encerrada', historico: [...r.historico, nota(por, em, 'Encerrou a reunião')] };
}

/** A ordem da lista: as que pedem algo primeiro (em análise, revisando, finalizada, concluída), depois pelo dia. */
export function ordenar<T extends Pick<Reuniao, 'status' | 'quando'>>(lista: readonly T[], agora: string): T[] {
  const peso: Record<StatusDaReuniao, number> = { 'em-analise': 0, revisando: 0, finalizada: 1, concluida: 1, 'em-andamento': 2, aprovada: 3, remarcada: 3, recusada: 5, encerrada: 6 };
  return [...lista].sort((a, b) => peso[statusDaReuniao(a, agora)] - peso[statusDaReuniao(b, agora)] || a.quando.localeCompare(b.quando));
}
