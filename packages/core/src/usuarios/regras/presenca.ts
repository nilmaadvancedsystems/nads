// Quem está online no nads (Vitor, 05/10/2026: "quero que coloque uma opção de online"): o nads aberto de cada pessoa
// grava usuarios/{uid}.nadsVistoEm a cada 3 minutos (só com a aba visível). Online = visto há menos de 5 minutos.
import type { DocUsuario, OndeNoNads } from '../tipos';

/** Quanto tempo sem sinal ainda conta como online (o ponto é a cada 3 min; sobra folga para um atraso). */
export const MINUTOS_ONLINE = 5;
/** De quanto em quanto tempo o nads aberto bate o ponto. */
export const PONTO_DA_PRESENCA_MS = 3 * 60 * 1000;

export function estaOnline(vistoEm: string | null | undefined, agora: Date): boolean {
  const t = vistoEm ? Date.parse(vistoEm) : NaN;
  return !isNaN(t) && agora.getTime() - t < MINUTOS_ONLINE * 60 * 1000;
}

/** O documento mudou só no sinal de vida (a hora do ponto e a hora do "onde está")? Entrar ou sair de uma etapa não é só o sinal. */
export function mudouSoOPonto(antes: DocUsuario | undefined, depois: DocUsuario): boolean {
  const semSinal = (d: DocUsuario) => JSON.stringify({ ...d, nadsVistoEm: '', nadsOnde: d.nadsOnde ? { ...d.nadsOnde, em: '' } : null });
  return !!antes && semSinal(antes) === semSinal(depois);
}

export interface AtividadeAtual { etapa: string; empresa: string; periodo: string }

/**
 * Onde a pessoa está, em Usuários (Vitor, 09/11/2026: "mostrar a empresa e etapa na qual a pessoa se encontra"), em partes
 * para a tela (10/11/2026: junto numa frase só ficava confuso). O sinal vale como o do online: a aba fechada ou escondida
 * deixa de contar sozinha. null = em nenhuma etapa.
 */
export function atividadeAtual(onde: OndeNoNads | null | undefined, agora: Date): AtividadeAtual | null {
  if (!onde || !estaOnline(onde.em, agora)) return null;
  return { etapa: onde.etapa, empresa: (onde.codigo != null ? onde.codigo + ' · ' : '') + onde.empresa, periodo: onde.competencia || '' };
}

/**
 * Quem vê a atividade atual (Vitor, 09/11/2026: "somente os seniores, apenas do seu setor, e os diretores, todos os
 * setores"). Ser admin não conta: o que vale é o nível.
 */
export function veAtividade(quem: { nivel?: string | null; departamento?: string | null }, pessoa: { departamento?: string | null }): boolean {
  if (quem.nivel === 'diretor') return true;
  return quem.nivel === 'senior' && !!quem.departamento && quem.departamento === pessoa.departamento;
}

/** "Online", "Visto há 12 min", "Visto há 3 h", "Visto há 2 dias" ou "Nunca abriu o nads". */
export function rotuloDaPresenca(vistoEm: string | null | undefined, agora: Date): string {
  const t = vistoEm ? Date.parse(vistoEm) : NaN;
  if (isNaN(t)) return 'Nunca abriu o nads';
  if (estaOnline(vistoEm, agora)) return 'Online';
  const min = Math.max(1, Math.floor((agora.getTime() - t) / 60000));
  if (min < 60) return 'Visto há ' + min + ' min';
  const h = Math.floor(min / 60);
  if (h < 24) return 'Visto há ' + h + ' h';
  const d = Math.floor(h / 24);
  return 'Visto há ' + d + (d === 1 ? ' dia' : ' dias');
}
