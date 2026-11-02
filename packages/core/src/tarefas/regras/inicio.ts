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
