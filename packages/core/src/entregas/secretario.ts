// Mandar arquivos para a pasta "Claudio Secretario" do Drive, de onde a rotina de arquivamento (a do PC do escritório)
// tira na próxima rodada e põe nas pastas dos clientes. O navegador não fala com o Drive: o arquivo vai pelo banco do
// Entregas, em pedaços, e o robô da nuvem grava (scripts/envios-do-nads.js no Entregas):
//   enviosSecretario/{id}            { status: 'enviando' → 'pendente' → 'gravando' → 'pronto' | 'erro', nome, tamanho,
//                                      partes, competencia: 'AAAA-MM', cliente?, codigo?, criadoEm, criadoPor, criadoPorUid,
//                                      pasta? (onde ficou), nomeFinal?, erro? }
//   enviosSecretario/{id}/partes/{n} { dados: bytes }   (o robô apaga depois de gravar)
// Destino: Claudio Secretario/<competencia>/<cliente> (sem cliente: "Enviados pelo nads"), como o robô do Gmail faz.

/** Cada pedaço cabe folgado num documento do banco (limite de 1 MiB). */
export const TAMANHO_DA_PARTE = 900 * 1024;
/** Até quanto um arquivo vai por aqui. */
export const MAX_ENVIO = 25 * 1024 * 1024;
/** Quantos arquivos por vez. */
export const MAX_ARQUIVOS_POR_ENVIO = 30;
export const PASTA_SEM_CLIENTE = 'Enviados pelo nads';

export interface DestinoDoEnvio {
  /** 'AAAA-MM' */
  competencia: string;
  /** o nome do cliente (a pasta dentro do mês); vazio = "Enviados pelo nads" */
  cliente: string;
  /** o código do cliente (o robô usa o nome do cadastro do Entregas) */
  codigo: string;
}

export interface ArquivoParaEnviar { nome: string; bytes: Uint8Array }

export interface AndamentoDoEnvio {
  status: 'enviando' | 'pendente' | 'gravando' | 'pronto' | 'erro';
  /** partes já subidas (enquanto 'enviando') */
  enviadas?: number;
  partes?: number;
  /** "2026-09/58 - TORNEARIA" (onde ficou) */
  pasta?: string;
  nomeFinal?: string;
  erro?: string;
}

/** 'AAAA-MM' da data. */
export function competenciaDe(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export const competenciaValida = (c: string) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(c);

/** O nome como vai para o Drive (sem caminho e sem caractere que o Windows recusa), igual ao robô. */
export function nomeParaEnviar(nome: string): string {
  const base = String(nome || '').split(/[\\/]/).pop() || '';
  return base.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 120) || 'arquivo';
}

/** O que impede de mandar este arquivo (ou '' quando pode). */
export function problemaDoArquivo(a: { nome: string; tamanho: number }): string {
  if (!a.tamanho) return 'está vazio';
  if (a.tamanho > MAX_ENVIO) return 'passa de ' + MAX_ENVIO / 1024 / 1024 + ' MB';
  return '';
}

/** Os pedaços do arquivo, na ordem. */
export function partesDoArquivo(bytes: Uint8Array, tamanho = TAMANHO_DA_PARTE): Uint8Array[] {
  const partes: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += tamanho) partes.push(bytes.subarray(i, Math.min(i + tamanho, bytes.length)));
  return partes;
}

/** O documento do envio conferido. */
export function andamentoDoEnvio(doc: Record<string, unknown> | null | undefined): AndamentoDoEnvio {
  const d = doc || {};
  const st = d.status;
  const status = st === 'pendente' || st === 'gravando' || st === 'pronto' || st === 'erro' ? st : 'enviando';
  const a: AndamentoDoEnvio = { status };
  if (typeof d.partes === 'number') a.partes = d.partes;
  if (d.pasta) a.pasta = String(d.pasta);
  if (d.nomeFinal) a.nomeFinal = String(d.nomeFinal);
  if (d.erro) a.erro = String(d.erro);
  return a;
}

/** "Claudio Secretario › 2026-09 › 58 - TORNEARIA" para mostrar onde vai (ou foi). */
export function ondeVai(destino: Pick<DestinoDoEnvio, 'competencia' | 'cliente'>): string {
  return ['Claudio Secretario', destino.competencia, destino.cliente.trim() || PASTA_SEM_CLIENTE].join(' › ');
}
