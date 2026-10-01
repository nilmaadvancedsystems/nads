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

// ---------- Meus envios: o que já mandei e onde foi parar (01/10/2026) ----------
// Depois de cada rodada do arquivamento, o robô grava no envio o destino (enviosSecretario/{id}.arquivamento):
//   { situacao: 'arquivado' | 'nao_identificado' | 'duplicado', em, execucao, codigo?, cliente?, subpasta?, final?, motivo? }
// O envio fica 30 dias no banco.

export interface ArquivamentoDoEnvio {
  situacao: 'arquivado' | 'nao_identificado' | 'duplicado';
  em: string;
  codigo: string;
  cliente: string;
  /** "CONTÁBIL/EXTRATOS/2026/08" (dentro da pasta do cliente) */
  subpasta: string;
  /** o nome que o arquivo ganhou ("08-2026.pdf") */
  final: string;
  motivo: string;
}

export interface EnvioFeito {
  id: string;
  nome: string;
  criadoEm: string;
  status: AndamentoDoEnvio['status'];
  /** "2026-09/TORNEARIA" (no Claudio Secretario) */
  pasta: string;
  erro: string;
  arquivamento: ArquivamentoDoEnvio | null;
}

const txt = (v: unknown) => (v == null ? '' : String(v));

export function envioFeitoDoDocumento(id: string, d: Record<string, unknown>): EnvioFeito {
  const a = d.arquivamento && typeof d.arquivamento === 'object' ? (d.arquivamento as Record<string, unknown>) : null;
  const situacao = a && (a.situacao === 'arquivado' || a.situacao === 'nao_identificado' || a.situacao === 'duplicado') ? a.situacao : null;
  return {
    id, nome: txt(d.nomeFinal || d.nome), criadoEm: txt(d.criadoEm), status: andamentoDoEnvio(d).status, pasta: txt(d.pasta), erro: txt(d.erro),
    arquivamento: a && situacao ? {
      situacao, em: txt(a.em), codigo: txt(a.codigo), cliente: txt(a.cliente), subpasta: txt(a.subpasta), final: txt(a.final), motivo: txt(a.motivo),
    } : null,
  };
}

/** Como o envio está, em uma frase (e o tom: ok, esperando, atenção). */
export function situacaoDoEnvioFeito(e: EnvioFeito): { tom: 'ok' | 'espera' | 'aviso'; texto: string } {
  if (e.status === 'erro') return { tom: 'aviso', texto: 'Não foi: ' + (e.erro || 'erro') };
  if (e.status !== 'pronto') return { tom: 'espera', texto: e.status === 'gravando' ? 'O robô está gravando no Drive' : 'Na fila do robô' };
  const a = e.arquivamento;
  if (!a) return { tom: 'espera', texto: 'Em Claudio Secretario › ' + e.pasta.split('/').join(' › ') + ' — esperando a próxima rodada do arquivamento' };
  if (a.situacao === 'arquivado') return { tom: 'ok', texto: 'Arquivado em ' + [a.codigo + ' - ' + a.cliente, ...a.subpasta.split('/').filter(Boolean), a.final].join(' › ') };
  if (a.situacao === 'duplicado') return { tom: 'aviso', texto: 'O arquivamento achou igual já guardado' + (a.motivo ? ': ' + a.motivo : '') };
  return { tom: 'aviso', texto: 'O arquivamento não identificou o cliente' + (a.motivo ? ' (' + a.motivo + ')' : '') };
}
