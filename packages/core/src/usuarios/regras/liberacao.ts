// Proteção do login do nads (2026-09-30): quem entra num computador novo precisa ser liberado por um admin.
// A pessoa entra com a conta do Entregas, o nads cria um pedido; o admin aprova e recebe um código de 6 dígitos,
// que passa para a pessoa (no escritório); ela digita e aquele login fica liberado até sair da conta.
// O login é reconhecido pela hora em que foi feito (auth_time do token, que as regras do banco enxergam):
//   nadsPedidos/{id}                 { uid, nome, email, computador, authTime, status, criadoEm, aprovadoPor?, aprovadoEm?,
//                                      validoAte? (timestamp: o código vale até lá), revogadoPor?, revogadoEm? }
//   nadsPedidos/{id}/codigo/atual    { codigo }            (só o admin lê)
//   nadsSessoes/{uid}_{authTime}     { uid, nome, email, computador, pedidoId, codigo, liberadoEm }
// As regras só deixam criar a sessão com o código certo de um pedido aprovado do próprio login, antes de validoAte.
// Revogar (01/10/2026) apaga a sessão, marca o pedido como 'revogado' e apaga o código: o mesmo código não vale mais,
// a pessoa pede de novo e a nova aprovação sorteia outro código.

export type SituacaoDoPedido = 'pendente' | 'aprovado' | 'recusado' | 'revogado';

/** Por quanto tempo o código vale depois de aprovado. */
export const PRAZO_DO_CODIGO_MS = 30 * 60 * 1000;

export interface PedidoDeLiberacao {
  id: string;
  uid: string;
  nome: string;
  email: string;
  computador: string;
  authTime: string;
  status: SituacaoDoPedido;
  criadoEm: string;
  aprovadoPor?: string;
  aprovadoEm?: string;
  /** até quando o código vale (ISO) */
  validoAte?: string;
  revogadoPor?: string;
}

export interface SessaoLiberada {
  id: string;
  /** o pedido que liberou (revogar invalida o código dele) */
  pedidoId: string;
  uid: string;
  nome: string;
  email: string;
  computador: string;
  liberadoEm: string;
}

const texto = (v: unknown) => (v == null ? '' : String(v));

/** O id da sessão liberada: o usuário e a hora do login. */
export const idDaSessao = (uid: string, authTime: string) => uid + '_' + authTime;

/** Um código de 6 dígitos (o sorteio vem de fora, para dar para testar). */
export function codigoNovo(sortear: () => number = Math.random): string {
  return String(Math.floor(sortear() * 1_000_000)).padStart(6, '0');
}

/** "Chrome · Windows" (o que der para saber pelo navegador). */
export function computadorDoNavegador(userAgent: string): string {
  const ua = userAgent || '';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const so = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return so ? nav + ' · ' + so : nav;
}

/** Data do banco (Timestamp do Firestore ou texto ISO) em ISO; '' quando não dá. */
function emIso(v: unknown): string {
  const ms = v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? (v as { toMillis(): number }).toMillis() : Date.parse(texto(v));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : '';
}

export function pedidoDoDocumento(id: string, d: Record<string, unknown>): PedidoDeLiberacao {
  const status = d.status === 'aprovado' || d.status === 'recusado' || d.status === 'revogado' ? d.status : 'pendente';
  const p: PedidoDeLiberacao = {
    id, uid: texto(d.uid), nome: texto(d.nome), email: texto(d.email), computador: texto(d.computador),
    authTime: texto(d.authTime), status, criadoEm: texto(d.criadoEm),
  };
  if (d.aprovadoPor) p.aprovadoPor = texto(d.aprovadoPor);
  if (d.aprovadoEm) p.aprovadoEm = texto(d.aprovadoEm);
  const validoAte = emIso(d.validoAte);
  if (validoAte) p.validoAte = validoAte;
  if (d.revogadoPor) p.revogadoPor = texto(d.revogadoPor);
  return p;
}

/** Aprovado, mas o código já venceu (ou é de antes do prazo existir): não vale mais. */
export const codigoVencido = (p: PedidoDeLiberacao, agora = Date.now()) =>
  p.status === 'aprovado' && (!p.validoAte || agora >= Date.parse(p.validoAte));

/** Aprovado por uma tela de admin desatualizada (sem o prazo): o código não passa nas regras; o admin precisa atualizar. */
export const aprovadoSemPrazo = (p: PedidoDeLiberacao | null) => !!p && p.status === 'aprovado' && !p.validoAte;

/** A pessoa precisa pedir de novo: sem pedido, recusado, revogado ou com o código vencido. */
export const precisaPedirDeNovo = (p: PedidoDeLiberacao | null, agora = Date.now()) =>
  !p || p.status === 'recusado' || p.status === 'revogado' || codigoVencido(p, agora);

export function sessaoDoDocumento(id: string, d: Record<string, unknown>): SessaoLiberada {
  return { id, pedidoId: texto(d.pedidoId), uid: texto(d.uid), nome: texto(d.nome), email: texto(d.email), computador: texto(d.computador), liberadoEm: texto(d.liberadoEm) };
}

/** Pedido velho (mais de 30 min sem resposta) não aparece mais para o admin. */
export const pedidoVencido = (p: PedidoDeLiberacao, agora = Date.now()) => !Date.parse(p.criadoEm) || agora - Date.parse(p.criadoEm) > 30 * 60 * 1000;

/** O código digitado: só os 6 dígitos. */
export const codigoDigitado = (s: string) => s.replace(/\D/g, '').slice(0, 6);
