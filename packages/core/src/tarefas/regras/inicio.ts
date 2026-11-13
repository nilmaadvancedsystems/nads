// O Início da Tarefas e o painel de Minhas empresas (27/10/2026: "a parte de inicio, vai ser informações do escritorio
// como avisos, ultima empresa que foi mexida e progresso dela"; "a parte de minhas empresas vai virar um dashboard de
// progresso das empresas"): o mural de avisos do escritório (o admin e o diretor escrevem, todos leem) e o resumo do
// progresso das empresas na competência.
import type { SituacaoGeral } from './execucao';

/** Um aviso do mural do escritório. */
export interface AvisoDoEscritorio {
  id: string;
  texto: string;
  /** quem escreveu (o nome na equipe) */
  por: string;
  /** quando (ISO) */
  em: string;
  /** fica em cima dos outros */
  fixado?: boolean;
  // o comunicado das Notificações do Início novo (13/11/2026: "Reuniões, avisos vai ficar fixado nessa pagina, links de
  // estudos da legislação, etc, comunicação de equipe em geral (sem chats)"); o aviso antigo não tem nada disso
  /** o tipo (sem tipo, é um aviso) */
  tipo?: TipoDeComunicado;
  /** o título curto (sem título, a lista mostra o começo do texto) */
  titulo?: string;
  /** o link (o estudo da legislação, a sala da reunião): só http(s) */
  link?: string;
  /** o dia e a hora da reunião, 'aaaa-mm-ddThh:mm' */
  quando?: string;
}

/** Os tipos de comunicado da equipe, na ordem do menu. */
export type TipoDeComunicado = 'aviso' | 'reuniao' | 'estudo' | 'geral';
export const TIPOS_DE_COMUNICADO: readonly { valor: TipoDeComunicado; rotulo: string }[] = [
  { valor: 'aviso', rotulo: 'Aviso' },
  { valor: 'reuniao', rotulo: 'Reunião' },
  { valor: 'estudo', rotulo: 'Estudo da legislação' },
  { valor: 'geral', rotulo: 'Comunicado' },
];
export const ehTipoDeComunicado = (v: unknown): v is TipoDeComunicado => TIPOS_DE_COMUNICADO.some(x => x.valor === v);
export const rotuloDoComunicado = (t: TipoDeComunicado | undefined): string => TIPOS_DE_COMUNICADO.find(x => x.valor === (t || 'aviso'))?.rotulo || 'Aviso';

/** O maior título e o maior link (em caracteres). */
export const MAIOR_TITULO_DO_COMUNICADO = 120;
export const MAIOR_LINK = 500;

/** O link é um endereço da internet (http ou https)? */
export function linkValido(link: string): boolean {
  if (!link) return false;
  try { const u = new URL(link); return (u.protocol === 'https:' || u.protocol === 'http:') && link.length <= MAIOR_LINK; } catch { return false; }
}

/** O que vai além do texto num comunicado novo. */
export interface ExtrasDoComunicado { tipo: TipoDeComunicado; titulo: string; link: string; quando: string }

/** O que impede de publicar o comunicado ('' quando pode): o texto, o título, o link e, na reunião, o dia e a hora. */
export function problemaDoComunicado(texto: string, x: ExtrasDoComunicado): string {
  if (x.titulo.trim().length > MAIOR_TITULO_DO_COMUNICADO) return 'O título passou de ' + MAIOR_TITULO_DO_COMUNICADO + ' caracteres.';
  if (x.link.trim() && !linkValido(x.link.trim())) return 'O link precisa começar com https://';
  if (x.tipo === 'estudo' && !x.link.trim()) return 'Ponha o link do estudo.';
  if (x.tipo === 'reuniao' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x.quando)) return 'Escolha o dia e a hora da reunião.';
  return problemaDoAviso(texto);
}

/** Os campos de um comunicado novo para gravar (só os que têm valor; o aviso simples fica como o antigo). */
export function camposDoComunicado(x: ExtrasDoComunicado): Partial<Pick<AvisoDoEscritorio, 'tipo' | 'titulo' | 'link' | 'quando'>> {
  return {
    ...(x.tipo !== 'aviso' ? { tipo: x.tipo } : {}),
    ...(x.titulo.trim() ? { titulo: x.titulo.trim() } : {}),
    ...(x.link.trim() ? { link: x.link.trim() } : {}),
    ...(x.tipo === 'reuniao' && x.quando ? { quando: x.quando } : {}),
  };
}

/** As reuniões que ainda vão acontecer ('aaaa-mm-ddThh:mm' de agora), a mais próxima primeiro. */
export function proximasReunioes<T extends Pick<AvisoDoEscritorio, 'tipo' | 'quando'>>(lista: readonly T[], agora: string): T[] {
  return lista.filter(a => a.tipo === 'reuniao' && !!a.quando && a.quando >= agora).sort((a, b) => a.quando!.localeCompare(b.quando!));
}

/** O maior aviso (em caracteres). */
export const MAIOR_AVISO = 1000;

/** O texto do aviso pronto para gravar: sem espaços sobrando nas pontas e sem linhas em branco repetidas. */
export function limparAviso(texto: string): string {
  return texto.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** O que impede de publicar o aviso ('' quando pode). */
export function problemaDoAviso(texto: string): string {
  const t = limparAviso(texto);
  if (!t) return 'Escreva o aviso.';
  if (t.length > MAIOR_AVISO) return 'O aviso passou de ' + MAIOR_AVISO + ' caracteres.';
  return '';
}

/** A ordem do mural: os fixados em cima; em cada grupo, o mais novo primeiro. */
export function ordenarAvisos<T extends Pick<AvisoDoEscritorio, 'em' | 'fixado'>>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => Number(!!b.fixado) - Number(!!a.fixado) || b.em.localeCompare(a.em));
}

/**
 * O mural junta os avisos mais novos (a leitura com limite) com os fixados (lidos à parte: 30/10/2026, o fixado antigo
 * saía da leitura dos mais novos e sumia do mural). O mesmo aviso nas duas fica uma vez, como está nos mais novos (a
 * leitura que chega primeiro quando alguém fixa ou desafixa).
 */
export function juntarAvisos<T extends Pick<AvisoDoEscritorio, 'id'>>(recentes: readonly T[], fixados: readonly T[]): T[] {
  const ids = new Set(recentes.map(a => a.id));
  return [...recentes, ...fixados.filter(a => !ids.has(a.id))];
}

/** O resumo do progresso das empresas (o painel de Minhas empresas). */
export interface ResumoDoProgresso {
  empresas: number;
  porSituacao: Record<SituacaoGeral, number>;
  /** etapas feitas (ou que não se aplicam) e o total de etapas, somando todas as empresas */
  etapasFeitas: number;
  etapasTotal: number;
  /** de 0 a 100, arredondado para baixo (só dá 100 com tudo feito) */
  porcentagem: number;
}

export function resumoDoProgresso(linhas: readonly { situacao: SituacaoGeral; concluidas: number; total: number }[]): ResumoDoProgresso {
  const porSituacao: Record<SituacaoGeral, number> = { 'nao-iniciada': 0, 'em-andamento': 0, parada: 0, concluida: 0 };
  let etapasFeitas = 0, etapasTotal = 0;
  for (const l of linhas) {
    porSituacao[l.situacao]++;
    etapasFeitas += l.concluidas;
    etapasTotal += l.total;
  }
  return { empresas: linhas.length, porSituacao, etapasFeitas, etapasTotal, porcentagem: porcentagemDe(etapasFeitas, etapasTotal) };
}

/** A porcentagem de feitas (0 a 100, para baixo: 99,9% fica 99). Sem total, 0. */
export function porcentagemDe(feitas: number, total: number): number {
  return total > 0 ? Math.floor((100 * Math.min(feitas, total)) / total) : 0;
}
