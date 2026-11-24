// As reuniões das Notificações do Início novo (Vitor, 13/11/2026). Pedida pelo Sênior: Em análise (o pedido) → Revisando (o
// Diretor ou o Dono abriu e deu um prazo de resposta) → Aprovada (aparece para quem vai) ou Recusada → Em andamento (quem
// criou clica em Iniciar reunião, a partir do dia; Vitor, 24/11/2026) → Finalizada (o Sênior anexou o Problema identificado e a Solução proposta e pede o comentário de quem
// participou) → Concluída (os dois arquivos e o comentário de cada participante) → Encerrada (o Diretor ou o Dono fecha).
// Remarcada quando precisa trocar o dia; Cancelada quando não vai acontecer (24/11/2026: as duas ficam 24 h no Painel). Marcada pelo Diretor ou pelo Dono: já aparece para todos, passa por Em andamento e,
// com o Problema e a Solução anexados, cai direto em Encerrada ("como eles sao tomadores de decisao final resolve").
// Só as regras: quem guarda é o repositório (dados/reunioes).
import { nivelDeDiretor } from '../../usuarios/regras/papeis';
import type { Nivel } from '../../usuarios/tipos';
import type { Anexo, Nota, Pessoa } from './delegadas';
import { limparAviso, linkValido, MAIOR_AVISO, MAIOR_TITULO_DO_COMUNICADO } from './inicio';

/** O que fica guardado; Em andamento não é guardado: é a aprovada (ou remarcada) que quem criou iniciou (iniciadaEm). */
export type StatusGuardado = 'em-analise' | 'revisando' | 'aprovada' | 'remarcada' | 'recusada' | 'cancelada' | 'finalizada' | 'concluida' | 'encerrada';
export type StatusDaReuniao = StatusGuardado | 'em-andamento';

export const ROTULO_DO_STATUS: Record<StatusDaReuniao, string> = {
  'em-analise': 'Em análise', revisando: 'Revisando', aprovada: 'Aprovada', remarcada: 'Remarcada', recusada: 'Recusada', cancelada: 'Cancelada',
  'em-andamento': 'Em andamento', finalizada: 'Finalizada', concluida: 'Concluída', encerrada: 'Encerrada',
};
/** a cor do selo de cada status (os tons dos selos do nads) */
export const TOM_DO_STATUS: Record<StatusDaReuniao, 'warn' | 'info' | 'ok' | 'neutral' | 'bad'> = {
  'em-analise': 'warn', revisando: 'warn', aprovada: 'info', remarcada: 'info', recusada: 'neutral', cancelada: 'neutral',
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
  /**
   * Quem marcou pediu a confirmação de presença (Vitor, 18/11/2026: "quando quem criou a reuniao marcar essa opcao, apareca no
   * calendario, igual ao aviso, a pessoa deve clicar em confirmar"): o calendário pede o Confirmar presença só destas.
   */
  pedirPresenca?: true;
  /**
   * Quando quem criou clicou em Iniciar reunião (Vitor, 24/11/2026: "No dia da reunião, muda a cor do card para vermelho e a
   * data para preto, e deixe piscando, enquanto o criador da reunião não mudar o status para em andamento"). Sem = não iniciou.
   */
  iniciadaEm?: string;
  /**
   * A última remarcação (Vitor, 24/11/2026: "muda o icone da data e aparece um novo card com a data nova"): o dia de antes e
   * quando remarcou. O Painel mostra o card do dia de antes por 24 h.
   */
  remarcadaDe?: string;
  remarcadaEm?: string;
  /** quando foi cancelada ("se só cancelar so aparece cancelada durante 24h") */
  canceladaEm?: string;
  /**
   * Fixada no Painel pelo Diretor ou pelo Dono, depois de finalizada ou cancelada (Vitor, 24/11/2026: "fixar a reuniao, apos ser
   * finalizada ou cancelada, para que todos os convidados tenha acesso a esse arquivo"): o card fica até alguém tirar.
   */
  fixada?: true;
  historico: Nota[];
  em: string;
}

/** O que a pessoa faz pelo nível: o Sênior pede, o Diretor e o Dono decidem e marcam direto, os outros participam. */
export type Papel = 'pede' | 'aprova' | 'participa';
export function papelPeloNivel(nivel: Nivel | null | undefined): Papel {
  if (nivelDeDiretor(nivel)) return 'aprova';
  return nivel === 'senior' ? 'pede' : 'participa';
}

/**
 * O status de agora: a aprovada (ou remarcada) que quem criou iniciou está Em andamento (até 24/11/2026 era sozinha, na hora).
 * agora: 'aaaa-mm-ddThh:mm' (fica para quem chama; o Em andamento não depende mais dele).
 */
export function statusDaReuniao(r: Pick<Reuniao, 'status' | 'quando' | 'iniciadaEm'>, _agora?: string): StatusDaReuniao {
  if ((r.status === 'aprovada' || r.status === 'remarcada') && r.iniciadaEm) return 'em-andamento';
  return r.status;
}

/** O dia da reunião chegou ('aaaa-mm-dd' de agora a partir do dia marcado). */
const diaChegou = (r: Pick<Reuniao, 'quando'>, agora: string) => !!r.quando && agora.slice(0, 10) >= r.quando.slice(0, 10);

/**
 * O card pisca em vermelho (Vitor, 24/11/2026): no dia da reunião, enquanto quem criou não clicar em Iniciar reunião.
 * agora: 'aaaa-mm-ddThh:mm'.
 */
export function piscaNoDia(r: Pick<Reuniao, 'status' | 'quando' | 'iniciadaEm'>, agora: string): boolean {
  const s = statusDaReuniao(r);
  return (s === 'aprovada' || s === 'remarcada') && !!r.quando && r.quando.slice(0, 10) === agora.slice(0, 10);
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

export type AcaoDaReuniao = 'revisar' | 'aprovar' | 'recusar' | 'remarcar' | 'cancelar' | 'fixar' | 'confirmar' | 'iniciar' | 'anexar' | 'finalizar' | 'comentar' | 'encerrar';

/** O que a pessoa pode fazer na reunião agora. */
export function acoes(r: Reuniao, quem: { uid: string; aprova: boolean }, agora: string): AcaoDaReuniao[] {
  const s = statusDaReuniao(r);
  const dono = responsavel(r, quem.uid) || (r.origem === 'direta' && quem.aprova);
  const a: AcaoDaReuniao[] = [];
  if (quem.aprova && r.origem === 'pedido' && (s === 'em-analise' || s === 'revisando')) a.push(...(s === 'em-analise' ? ['revisar' as const] : []), 'aprovar', 'recusar');
  if ((dono || quem.aprova) && (s === 'aprovada' || s === 'remarcada' || s === 'em-andamento')) a.push('remarcar');
  // cancela quem pode remarcar, antes de começar (24/11/2026: "quando a pessoa não consegue")
  if ((dono || quem.aprova) && (s === 'aprovada' || s === 'remarcada')) a.push('cancelar');
  // o convidado responde se vai até a reunião começar (e pode mudar a resposta)
  if ((s === 'aprovada' || s === 'remarcada') && r.participantes.some(p => p.uid === quem.uid)) a.push('confirmar');
  // quem criou inicia a partir do dia (a marcada direto, também o Diretor e o Dono)
  if (dono && (s === 'aprovada' || s === 'remarcada') && diaChegou(r, agora)) a.push('iniciar');
  // finalizar sem os arquivos também (24/11/2026: a janela do Finalizar pergunta se quer anexar)
  if (dono && s === 'em-andamento') a.push('anexar', 'finalizar');
  if (s === 'finalizada' && r.participantes.some(p => p.uid === quem.uid) && !r.comentarios.some(c => c.uid === quem.uid)) a.push('comentar');
  if (quem.aprova && s === 'concluida') a.push('encerrar');
  // o Diretor e o Dono fixam (e tiram) no Painel a que já terminou
  if (quem.aprova && podeFixar(s)) a.push('fixar');
  return a;
}

// ---------------------------------------------------------------------------------------------------------------------
// pedir e marcar
// ---------------------------------------------------------------------------------------------------------------------

export interface PedidoDeReuniao {
  titulo: string; pauta: string; quando: string; link: string; participantes: Pessoa[]; comDiretor: boolean; tipo: TipoDaReuniao; duracao: number;
  /** quem marca pede a confirmação de presença (Vitor, 18/11/2026: "uma opcao de marcar, de confirmar presenca") */
  pedirPresenca?: boolean;
}

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
    ...(p.duracao > 0 ? { duracao: p.duracao } : {}), ...(p.pedirPresenca ? { pedirPresenca: true as const } : {}),
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
  // o prazo da revisão sai com a decisão
  const resto: Reuniao = { ...r };
  delete resto.prazoDaRevisao;
  return { ...resto, status: aprovar ? 'aprovada' : 'recusada', decididoPor: por, ...(obs ? { observacao: obs } : {}), historico: [...r.historico, nota(por, em, aprovar ? 'Aprovou a reunião' : 'Recusou a reunião')] };
}

export function remarcar(r: Reuniao, quando: string, por: string, em: string): Reuniao {
  // remarcada, volta a esperar o Iniciar reunião no dia novo; guarda o dia de antes (o card dele fica 24 h no Painel)
  const resto: Reuniao = { ...r };
  delete resto.iniciadaEm;
  return { ...resto, quando, status: 'remarcada', ...(r.quando && r.quando !== quando ? { remarcadaDe: r.quando, remarcadaEm: em } : {}), historico: [...r.historico, nota(por, em, 'Remarcou para ' + quando.slice(0, 10).split('-').reverse().join('/') + ' ' + quando.slice(11))] };
}

/** Cancela a reunião que ainda não começou: fica Cancelada e o Painel mostra por 24 h. */
export function cancelar(r: Reuniao, por: string, em: string): Reuniao {
  const s = statusDaReuniao(r);
  if (s !== 'aprovada' && s !== 'remarcada') throw new Error('Só a reunião marcada e ainda não iniciada pode ser cancelada.');
  return { ...r, status: 'cancelada', canceladaEm: em, historico: [...r.historico, nota(por, em, 'Cancelou a reunião')] };
}

/** Quando foi finalizada (a nota do histórico; sem ela, ''): o card "Finalizada" fica 24 h no Painel. */
export function finalizadaEm(r: Pick<Reuniao, 'historico'>): string {
  return [...r.historico].reverse().find(n => n.texto.startsWith('Finalizou'))?.em || '';
}

/** Só a reunião que já terminou (finalizada, concluída, encerrada) ou foi cancelada fica fixada. */
export const podeFixar = (s: StatusDaReuniao) => s === 'finalizada' || s === 'concluida' || s === 'encerrada' || s === 'cancelada';

/** Fixa (ou tira) a reunião no Painel, para quem foi convidado ver o card e baixar os arquivos. */
export function fixar(r: Reuniao, sim: boolean, por: string, em: string): Reuniao {
  if (sim && !podeFixar(statusDaReuniao(r))) throw new Error('Só a reunião finalizada ou cancelada pode ser fixada.');
  if (!!r.fixada === sim) return r;
  const resto: Reuniao = { ...r };
  delete resto.fixada;
  return { ...resto, ...(sim ? { fixada: true as const } : {}), historico: [...r.historico, nota(por, em, sim ? 'Fixou a reunião no Painel' : 'Tirou a reunião do Painel')] };
}

/** Quanto tempo o card da cancelada e o do dia de antes da remarcada ficam no Painel. */
export const HORAS_NO_PAINEL = 24;
/** em (ISO) foi há menos de 24 h? agora em milissegundos */
export const recente = (em: string | undefined, agora: number) => {
  const t = em ? Date.parse(em) : NaN;
  return Number.isFinite(t) && agora - t < HORAS_NO_PAINEL * 3600_000;
};

/** Quem criou inicia a reunião: fica Em andamento e o card para de piscar. */
export function iniciar(r: Reuniao, por: string, em: string): Reuniao {
  if (r.status !== 'aprovada' && r.status !== 'remarcada') throw new Error('Só a reunião aprovada pode ser iniciada.');
  if (r.iniciadaEm) return r;
  return { ...r, iniciadaEm: em, historico: [...r.historico, nota(por, em, 'Iniciou a reunião')] };
}

export function anexar(r: Reuniao, qual: 'problema' | 'solucao', a: Anexo, por: string, em: string): Reuniao {
  return { ...r, [qual]: a, historico: [...r.historico, nota(por, em, (qual === 'problema' ? 'Anexou o Problema identificado: ' : 'Anexou a Solução proposta: ') + a.nome)] };
}

/**
 * Finaliza: a marcada direto (o Diretor ou o Dono) cai direto em Encerrada; a pedida fica Finalizada, esperando o comentário
 * de quem participou (sem participante, já fica Concluída).
 */
export function finalizar(r: Reuniao, por: string, em: string): Reuniao {
  // os arquivos deixaram de ser obrigatórios (Vitor, 24/11/2026: "Ao cancelar ou clicar em finalizar, aí voce abre uma popup
  // perguntando se deseja anexar uma arquivo")
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
export function ordenar<T extends Pick<Reuniao, 'status' | 'quando' | 'iniciadaEm'>>(lista: readonly T[], agora: string): T[] {
  const peso: Record<StatusDaReuniao, number> = { 'em-analise': 0, revisando: 0, finalizada: 1, concluida: 1, 'em-andamento': 2, aprovada: 3, remarcada: 3, recusada: 5, cancelada: 5, encerrada: 6 };
  return [...lista].sort((a, b) => peso[statusDaReuniao(a, agora)] - peso[statusDaReuniao(b, agora)] || a.quando.localeCompare(b.quando));
}
