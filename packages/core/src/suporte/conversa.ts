// A conversa de cada feedback (Vitor, 16/11/2026: "preciso de um chat onde eu possa responder os feedbacks, para entender
// mais, fazendo perguntas"). O admin pergunta no feedback aberto (Admin › Feedbacks); quem mandou recebe a pergunta numa
// janela grande na tela (que, fechada, fica no balão do suporte) e responde; os dois veem o histórico. Só o admin começa;
// depois, os dois escrevem quantas vezes quiserem até o feedback ser resolvido.
//
// No banco: cada mensagem em feedbacks/{id}/mensagens (lida só com a conversa aberta) e, no próprio feedback, o resumo
// `conversa` (quantas, de quem foi a última, quando e o começo dela), que já chega a quem ouve o feedback: a lista do admin
// mostra "Esperando resposta" ou "Respondeu" e o balão de quem mandou mostra a última sem ler as mensagens.
// TypeScript puro: quem chama lê e grava no banco.
import { NOME_MAXIMO } from './delegacao';

/** Quem escreveu: o admin (quem resolve) ou quem mandou o feedback. */
export type LadoDaConversa = 'admin' | 'autor';

/** Uma mensagem da conversa (feedbacks/{id}/mensagens/{id}). */
export interface MensagemDoFeedback {
  id: string;
  de: LadoDaConversa;
  /** o nome de quem escreveu, como estava ao escrever */
  nome: string;
  texto: string;
  /** ISO */
  em: string;
}

/** O resumo gravado no feedback (o campo `conversa`). */
export interface ResumoDaConversa {
  /** quantas mensagens já foram */
  qtd: number;
  ultimaDe: LadoDaConversa;
  /** ISO */
  ultimaEm: string;
  /** o começo da última mensagem (para o balão e a lista, sem ler as mensagens) */
  ultimoTexto: string;
}

/** O texto de uma mensagem vai até este tanto de letras (a regra do banco confere o mesmo). */
export const TEXTO_MAXIMO = 2000;
/** O começo da última mensagem guardado no resumo. */
export const RESUMO_MAXIMO = 280;

/** O que impede de mandar o texto (null = pode). */
export function problemaDaMensagem(texto: string): string | null {
  const t = texto.trim();
  if (!t) return 'Escreva a mensagem.';
  if (t.length > TEXTO_MAXIMO) return 'A mensagem passou de ' + TEXTO_MAXIMO + ' letras (tem ' + t.length + '). Divida em duas.';
  return null;
}

/** Quem pode escrever agora: o admin, enquanto não está resolvido; quem mandou, só depois que o admin começou. */
export function podeEscrever(lado: LadoDaConversa, status: string, conversa: ResumoDaConversa | null): boolean {
  if (status === 'feito') return false;
  return lado === 'admin' || !!conversa;
}

/** A mensagem nova, pronta para gravar, e o resumo do feedback depois dela. */
export function mensagemNova(antes: ResumoDaConversa | null, de: LadoDaConversa, nome: string, texto: string, agora: Date): { mensagem: Omit<MensagemDoFeedback, 'id'>; resumo: ResumoDaConversa } {
  const problema = problemaDaMensagem(texto);
  if (problema) throw new Error(problema);
  if (de === 'autor' && !antes) throw new Error('Só dá para responder depois que o suporte perguntar.');
  const t = texto.trim();
  const em = agora.toISOString();
  return {
    mensagem: { de, nome: nome.trim().slice(0, NOME_MAXIMO), texto: t, em },
    resumo: { qtd: (antes?.qtd ?? 0) + 1, ultimaDe: de, ultimaEm: em, ultimoTexto: resumir(t) },
  };
}

/** O começo do texto, numa linha, para o resumo. */
export function resumir(texto: string): string {
  const linha = texto.replace(/\s+/g, ' ').trim();
  return linha.length > RESUMO_MAXIMO ? linha.slice(0, RESUMO_MAXIMO - 1).trimEnd() + '…' : linha;
}

const ehLado = (v: unknown): v is LadoDaConversa => v === 'admin' || v === 'autor';
const texto = (v: unknown) => (typeof v === 'string' ? v : '');

/** Lê do banco o resumo (null = sem conversa, ou um mapa que não fecha). */
export function lerResumoDaConversa(v: unknown): ResumoDaConversa | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>;
  const qtd = Number(x.qtd);
  if (!Number.isInteger(qtd) || qtd < 1 || !ehLado(x.ultimaDe)) return null;
  return { qtd, ultimaDe: x.ultimaDe, ultimaEm: texto(x.ultimaEm), ultimoTexto: texto(x.ultimoTexto) };
}

/** Lê do banco uma mensagem (null = sem texto ou sem lado). */
export function lerMensagem(id: string, v: unknown): MensagemDoFeedback | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>;
  if (!ehLado(x.de) || !texto(x.texto).trim()) return null;
  return { id, de: x.de, nome: texto(x.nome), texto: texto(x.texto), em: texto(x.em) };
}

/** As mensagens na ordem em que foram escritas (a mais velha em cima). */
export function emOrdem<T extends Pick<MensagemDoFeedback, 'em' | 'id'>>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => a.em.localeCompare(b.em) || a.id.localeCompare(b.id));
}

/** Em que pé está a conversa: sem conversa, esperando quem mandou responder, ou quem mandou respondeu. */
export type SituacaoDaConversa = '' | 'esperando' | 'respondeu';

export function situacaoDaConversa(conversa: ResumoDaConversa | null): SituacaoDaConversa {
  if (!conversa) return '';
  return conversa.ultimaDe === 'admin' ? 'esperando' : 'respondeu';
}

/** O selo da lista do admin (vazio = sem conversa). */
export function seloDaConversa(conversa: ResumoDaConversa | null): { rotulo: string; tom: 'neutro' | 'novo' } | null {
  const s = situacaoDaConversa(conversa);
  if (s === 'esperando') return { rotulo: 'Esperando resposta', tom: 'neutro' };
  if (s === 'respondeu') return { rotulo: 'Respondeu', tom: 'novo' };
  return null;
}

/**
 * A conversa que abre sozinha, grande, na tela de quem mandou: a mais velha com pergunta do admin que este navegador ainda
 * não mostrou (vistas: id → quantas mensagens tinha quando abriu). Resolvido não abre. null = nenhuma.
 */
export function conversaParaAbrir(meus: readonly { id: string; status: string; criadoEm: string; conversa: ResumoDaConversa | null }[], vistas: Readonly<Record<string, number>>): string | null {
  const novas = meus
    .filter(f => f.status !== 'feito' && f.conversa?.ultimaDe === 'admin' && f.conversa.qtd > (vistas[f.id] ?? 0))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  return novas[0]?.id ?? null;
}

/** Quantas conversas esperam a resposta de quem mandou (o número do botão do balão). */
export function esperandoMinhaResposta(meus: readonly { status: string; conversa: ResumoDaConversa | null }[]): number {
  return meus.filter(f => f.status !== 'feito' && situacaoDaConversa(f.conversa) === 'esperando').length;
}
