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
  return !!numero && w.pronto && (w.liberado || w.teste.includes(numero));
}

/** A situação em poucas palavras, para a tela (o porquê vai à parte, em `motivo`). */
export function textoDoWhatsapp(w: WhatsappDoRobo): string {
  if (w.situacao === 'conectado') return w.pronto ? 'Conectado' : 'Sem notícia do robô';
  if (w.situacao === 'aguardando-qr') return 'Esperando o QR code';
  if (w.situacao === 'conectando') return 'Conectando';
  if (w.situacao === 'desconectado') return 'Desconectado';
  return 'Desligado';
}
