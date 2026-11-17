// O WhatsApp do robô (12/11/2026): o chip novo do escritório conectado pelo QR code no robô da nuvem (robo/whatsapp.js).
// O robô escreve a situação em robo/estado.whatsapp (robo/whatsapp-regras.js › estadoParaOBanco); o nads lê por aqui.
// Os pedidos vão pela fila do Gmail (solicitacoesEmail), com os tipos abaixo.

export type SituacaoDoWhatsapp = 'desligado' | 'desconectado' | 'aguardando-qr' | 'conectando' | 'conectado';

export interface WhatsappDoRobo {
  situacao: SituacaoDoWhatsapp;
  /** o texto do QR code (só enquanto aguarda) */
  qr: string;
  /** o número conectado, só dígitos (55 + DDD + número) */
  numero: string;
  nome: string;
  /** desde quando está conectado (ISO) */
  desde: string;
  /** por que não está conectado */
  motivo: string;
  /** a trava: false = só sai para os números de teste (o WhatsApp do escritório) */
  liberado: boolean;
  teste: string[];
  atualizadoEm: string;
  /** conectado e o robô deu notícia há pouco: dá para mandar pelo robô */
  pronto: boolean;
}

export const TIPOS_DO_WHATSAPP = { enviar: 'whatsapp', conectar: 'whatsapp-conectar', desconectar: 'whatsapp-desconectar' } as const;

/** O robô renova o atualizadoEm de 10 em 10 min enquanto conectado; passou disto sem notícia, o robô está fora. */
export const WHATSAPP_SEM_NOTICIA_MS = 30 * 60000;

const SITUACOES: SituacaoDoWhatsapp[] = ['desligado', 'desconectado', 'aguardando-qr', 'conectando', 'conectado'];
const texto = (v: unknown) => (typeof v === 'string' ? v : '');

export const WHATSAPP_DESLIGADO: WhatsappDoRobo = {
  situacao: 'desligado', qr: '', numero: '', nome: '', desde: '', motivo: 'o robô da nuvem ainda não ligou o WhatsApp', liberado: false, teste: [], atualizadoEm: '', pronto: false,
};

/** robo/estado.whatsapp como veio do banco (qualquer coisa) → o que a tela usa. */
export function lerWhatsappDoRobo(bruto: unknown, agora: Date): WhatsappDoRobo {
  if (!bruto || typeof bruto !== 'object') return WHATSAPP_DESLIGADO;
  const d = bruto as Record<string, unknown>;
  const situacao = SITUACOES.includes(d.situacao as SituacaoDoWhatsapp) ? d.situacao as SituacaoDoWhatsapp : 'desligado';
  const atualizadoEm = texto(d.atualizadoEm);
  const quando = Date.parse(atualizadoEm);
  const recente = Number.isFinite(quando) && agora.getTime() - quando < WHATSAPP_SEM_NOTICIA_MS;
  return {
    situacao, qr: situacao === 'aguardando-qr' ? texto(d.qr) : '', numero: texto(d.numero).replace(/\D/g, ''), nome: texto(d.nome), desde: texto(d.desde),
    motivo: texto(d.motivo), liberado: d.liberado === true, teste: Array.isArray(d.teste) ? d.teste.map(String) : [], atualizadoEm,
    pronto: situacao === 'conectado' && recente,
  };
}

/** Pode mandar para este número pelo robô? Conectado e (liberado ou um número de teste). '' = o número inválido. */
export function mandaPeloRobo(w: WhatsappDoRobo, numero: string): boolean {
  return !!numero && w.pronto && (w.liberado || w.teste.some(n => mesmoNumero(n, numero)));
}

/** A situação em poucas palavras, para a tela (o porquê vai à parte, em `motivo`). */
export function textoDoWhatsapp(w: WhatsappDoRobo): string {
  if (w.situacao === 'conectado') return w.pronto ? 'Conectado' : 'Sem notícia do robô';
  if (w.situacao === 'aguardando-qr') return 'Esperando o QR code';
  if (w.situacao === 'conectando') return 'Conectando';
  if (w.situacao === 'desconectado') return 'Desconectado';
  return 'Desligado';
}

/** O celular do Brasil com e sem o 9 da frente (conta antiga ficou no WhatsApp com 8 dígitos): o mesmo número? */
export function mesmoNumero(a: string, b: string): boolean {
  const sem9 = (n: string) => {
    const d = n.replace(/\D/g, '');
    return /^55\d{2}9[6-9]\d{7}$/.test(d) ? d.slice(0, 4) + d.slice(5) : d;
  };
  return !!a && !!b && sem9(a) === sem9(b);
}

/** o tamanho de cada pedaço do anexo (base64) em solicitacoesEmail/{id}/partes/{n}: a regra do banco aceita até 900 mil */
export const PEDACO_DO_ANEXO = 800000;
/** a regra do banco aceita até 12 partes; o robô, até 5 MB */
export const MAX_ANEXO_BYTES = 5 * 1024 * 1024;

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Os bytes em base64 (sem depender do navegador nem do Node). */
export function paraBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += LETRAS[(n >> 18) & 63] + LETRAS[(n >> 12) & 63] + (b === undefined ? '=' : LETRAS[(n >> 6) & 63]) + (c === undefined ? '=' : LETRAS[n & 63]);
  }
  return s;
}

/** O anexo (o PDF do pedido) em pedaços base64 para as partes do pedido; erro se passar do tamanho que o robô aceita. */
export function pedacosDoAnexo(bytes: Uint8Array): string[] {
  if (!bytes.length) return [];
  if (bytes.length > MAX_ANEXO_BYTES) throw new Error('o anexo passa de 5 MB');
  const b64 = paraBase64(bytes);
  const pedacos: string[] = [];
  for (let i = 0; i < b64.length; i += PEDACO_DO_ANEXO) pedacos.push(b64.slice(i, i + PEDACO_DO_ANEXO));
  return pedacos;
}

/** "entregue 14:02 · lido 14:10" (os tiques do WhatsApp, na hora de Brasília); '' = ainda não chegou. */
export function textoDaEntrega(s: { entregueEm?: string; lidoEm?: string }): string {
  const hora = (iso?: string) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return '';
    const d = new Date(t - 3 * 3600000);
    return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + ' ' + String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  };
  const entregue = hora(s.entregueEm);
  const lido = hora(s.lidoEm);
  return [entregue ? 'entregue ' + entregue : '', lido ? 'lido ' + lido : ''].filter(Boolean).join(' · ');
}
