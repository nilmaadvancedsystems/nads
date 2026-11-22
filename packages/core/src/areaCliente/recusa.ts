// A recusa do documento mandado pelo cliente (22/11/2026, Documentos do cliente; o dono: "Faz e publica a regra"). Em
// Área do Cliente › Recebidos, a equipe recusa um arquivo com o motivo que o cliente vê. A equipe grava
// areaClienteRecusas/{id do recebido} { motivo, por, porUid, em, tratada: false } (regra nova: só a equipe cria; um
// recebido, uma recusa); o robô do PC marca o recibo do cliente como recusado (o motivo aparece na lista de enviados e no
// sino), desfaz a baixa do documento no mês (o "Falta mandar" volta) e anota em areaClienteRecebidos para a equipe. Só a
// lógica.

/** Os motivos prontos (a equipe escolhe um ou escreve o seu). */
export const MOTIVOS_DA_RECUSA = [
  'O arquivo não abre ou está ilegível',
  'É de outro mês',
  'Faltam páginas',
  'Não é o documento pedido',
  'O arquivo tem senha',
] as const;

export const MAIOR_MOTIVO = 300;

/** O erro do motivo ('' = serve). */
export function erroDaRecusa(motivo: string): string {
  const m = motivo.trim();
  if (m.length < 3) return 'Escreva o motivo da recusa (o cliente vai ver).';
  if (m.length > MAIOR_MOTIVO) return 'O motivo pode ter até ' + MAIOR_MOTIVO + ' caracteres.';
  return '';
}

/** O documento que a equipe grava em areaClienteRecusas/{id}; null com o motivo torto ou sem quem recusou. */
export function pedidoDeRecusa(motivo: string, por: string, porUid: string, agora: Date): { motivo: string; por: string; porUid: string; em: string; tratada: false } | null {
  if (erroDaRecusa(motivo) || !porUid) return null;
  return { motivo: motivo.trim(), por: (por || 'Escritório').trim().slice(0, 80), porUid, em: agora.toISOString(), tratada: false };
}

/** A recusa como o robô a lê (o torto vira null). */
export function recusaLida(x: unknown): { motivo: string; por: string; em: string } | null {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const motivo = typeof o.motivo === 'string' ? o.motivo.trim() : '';
  if (erroDaRecusa(motivo)) return null;
  return { motivo, por: typeof o.por === 'string' ? o.por.slice(0, 80) : '', em: typeof o.em === 'string' ? o.em : '' };
}
