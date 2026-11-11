// O Mandei no banco do Entregas (11/11/2026), nas regras publicadas em 07/10/2026 (docs/mandei/regras-do-banco.md):
//   - tickets/{id}: o ticket inteiro, o controle interno (só a equipe no nads);
//   - ticketsLinks/{codigo}: um documento por link, só com o que o cliente vê (o DocDoLink). O cliente lê pelo código e,
//     enquanto o link vale (a hora do servidor) e não está fechado, só marca que abriu e manda as respostas e a lista dos
//     arquivos (abertoEm, respostas, respondidoEm, arquivos);
//   - enviosSecretario/{id}: o arquivo que o cliente anexa (com o código do link em `ticket`); o robô grava no Drive.
// Aqui, as contas entre o ticket e o documento do link: o que se grava ao criar um link, o que se lê dele, e o ticket que
// a equipe vê, já com o que o cliente fez no link (as respostas, os arquivos, quando abriu). TypeScript puro.
import {
  aplicarRespostas, chavesDoItem, chavesParaRefazer, linkAtual, rotuloDoNumero,
  type ArquivoDoTicket, type EventoDoTicket, type ItemDoTicket, type LinkDoTicket, type RespostaDoItem, type StatusDoArquivo, type Ticket, type VistaDoCliente,
} from './index';

/** Um arquivo que o cliente anexou pelo link (o id é o do envio em enviosSecretario). */
export interface ArquivoNoLink { id: string; nome: string; tamanho: number; itemId?: string; enviadoEm: string }

/** O documento ticketsLinks/{codigo}: só o que o cliente vê e o que ele grava. Datas em ISO (o validoAte vira data do banco). */
export interface DocDoLink {
  /** o id do ticket (a equipe acha o ticket pelo link) */
  ticket: string;
  numero: string; empresa: string; mensagem: string; itens: ItemDoTicket[];
  respostas: Record<string, RespostaDoItem>;
  arquivos: ArquivoNoLink[];
  /** o que o escritório pediu de novo: a chave e o motivo */
  refazer: Record<string, string>;
  validoAte: string;
  /** os campos do envio do arquivo (enviosSecretario: o cliente, o código e o mês, que a regra pede) */
  envio: { cliente: string; codigo: string; competencia: string };
  /** resolvido, ou trocado por um link mais novo: o banco não aceita mais nada */
  fechado: boolean;
  abertoEm?: string;
  respondidoEm?: string;
}

const mesDe = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

/** O documento de um link novo: o formulário do ticket como está agora (as respostas e os arquivos que já vieram). */
export function docDoLink(t: Ticket, link: LinkDoTicket, agora: Date): DocDoLink {
  return {
    ticket: t.id, numero: rotuloDoNumero(t.numero), empresa: t.empresa.nome, mensagem: t.mensagem, itens: t.itens,
    respostas: t.respostas,
    arquivos: t.arquivos.filter(a => a.status !== 'erro').map(a => ({ id: a.id, nome: a.nome, tamanho: a.tamanho, enviadoEm: a.enviadoEm, ...(a.itemId ? { itemId: a.itemId } : {}) })),
    refazer: Object.fromEntries(chavesParaRefazer(t).map(k => [k, t.revisao?.[k]?.motivo || ''])),
    validoAte: link.validoAte,
    envio: {
      cliente: t.empresa.nome.slice(0, 150), codigo: String(t.empresa.codigo ?? '').slice(0, 20),
      competencia: /^\d{4}-(0[1-9]|1[0-2])$/.test(t.origem.competencia || '') ? (t.origem.competencia as string) : mesDe(agora),
    },
    fechado: !!t.resolvidoEm,
  };
}

const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});

/** O documento como veio do banco (o que o cliente grava não é de confiança: só os campos e os tipos certos). */
export function lerDocDoLink(raw: Record<string, unknown>): DocDoLink | null {
  const itens = Array.isArray(raw.itens) ? raw.itens as ItemDoTicket[] : [];
  if (!texto(raw.ticket) || !itens.length || !texto(raw.validoAte)) return null;
  const respostasBrutas = objeto(raw.respostas) as Record<string, RespostaDoItem>;
  const env = objeto(raw.envio);
  return {
    ticket: texto(raw.ticket), numero: texto(raw.numero), empresa: texto(raw.empresa), mensagem: texto(raw.mensagem), itens,
    respostas: aplicarRespostas(itens, {}, respostasBrutas),
    arquivos: (Array.isArray(raw.arquivos) ? raw.arquivos : []).map(objeto).filter(a => texto(a.id) && texto(a.nome)).slice(0, 100).map(a => ({
      id: texto(a.id), nome: texto(a.nome).slice(0, 200), tamanho: typeof a.tamanho === 'number' ? a.tamanho : 0, enviadoEm: texto(a.enviadoEm),
      ...(texto(a.itemId) ? { itemId: texto(a.itemId) } : {}),
    })),
    refazer: Object.fromEntries(Object.entries(objeto(raw.refazer)).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    validoAte: texto(raw.validoAte),
    envio: { cliente: texto(env.cliente), codigo: texto(env.codigo), competencia: texto(env.competencia) },
    fechado: raw.fechado === true,
    ...(texto(raw.abertoEm) ? { abertoEm: texto(raw.abertoEm) } : {}),
    ...(texto(raw.respondidoEm) ? { respondidoEm: texto(raw.respondidoEm) } : {}),
  };
}

/** O link do documento vale? (não fechado e antes do prazo; o banco confere de novo pela hora do servidor) */
export const docValido = (d: Pick<DocDoLink, 'fechado' | 'validoAte'>, agora: Date): boolean => !d.fechado && agora.getTime() <= new Date(d.validoAte).getTime();

/** O que o formulário mostra, a partir do documento do link. */
export function vistaDoDoc(d: DocDoLink): VistaDoCliente {
  return {
    numero: d.numero, empresa: d.empresa, mensagem: d.mensagem, itens: d.itens, respostas: d.respostas,
    arquivos: d.arquivos.map(a => ({ nome: a.nome, ...(a.itemId ? { itemId: a.itemId } : {}) })),
    validoAte: d.validoAte, ...(d.respondidoEm ? { respondidoEm: d.respondidoEm } : {}), refazer: d.refazer,
  };
}

/** O andamento de um envio do cliente, pelo que o robô grava em enviosSecretario. */
export interface EstadoDoEnvio { status: StatusDoArquivo; local?: string; erro?: string }
export function estadoDoEnvio(raw: Record<string, unknown>): EstadoDoEnvio {
  const s = texto(raw.status);
  if (s === 'erro') return { status: 'erro', ...(texto(raw.erro) ? { erro: texto(raw.erro) } : {}) };
  if (s === 'pronto') return { status: 'no-drive', ...(texto(raw.pasta) || texto(raw.nomeFinal) ? { local: [texto(raw.pasta), texto(raw.nomeFinal)].filter(Boolean).join(' › ') } : {}) };
  return { status: s === 'enviando' ? 'subindo' : 'na-fila' };
}

const chaveDoEvento = (e: EventoDoTicket) => e.tipo + '|' + e.em + '|' + (e.texto || '');

/**
 * O ticket que a equipe vê: o do banco com o que o cliente fez nos links (11/11/2026). De cada link, quando abriu; do
 * link atual, as respostas e quando mandou (o que ele respondeu de novo sai do "refazer"); de todos, os arquivos (com o
 * andamento do envio, quando tem). O histórico ganha o que veio do cliente, sem repetir o que já estava guardado.
 */
export function ticketComOsLinks(t: Ticket, docs: Readonly<Record<string, DocDoLink | undefined>>, envios: Readonly<Record<string, EstadoDoEnvio>> = {}): Ticket {
  const atual = linkAtual(t);
  const doAtual = docs[atual.codigo];
  const links = t.links.map(l => { const d = docs[l.codigo]; return d?.abertoEm && !l.abertoEm ? { ...l, abertoEm: d.abertoEm } : l; });
  // os arquivos: os guardados no ticket e os de cada link, sem repetir; o andamento pelo envio
  const porId = new Map<string, ArquivoDoTicket>(t.arquivos.map(a => [a.id, a]));
  for (const d of Object.values(docs)) {
    for (const a of d?.arquivos || []) if (!porId.has(a.id)) porId.set(a.id, { ...a, status: 'na-fila', envioId: a.id });
  }
  const arquivos = [...porId.values()].map(a => { const e = envios[a.envioId || a.id]; return e ? { ...a, ...e } : a; });
  let respostas = t.respostas, respondidoEm = t.respondidoEm, revisao = t.revisao;
  if (doAtual) {
    respostas = doAtual.respostas;
    if (doAtual.respondidoEm) {
      respondidoEm = doAtual.respondidoEm;
      const r = { ...(revisao || {}) };
      for (const k of chavesParaRefazer(t)) if (doAtual.respostas[k]) delete r[k];
      revisao = Object.keys(r).length ? r : undefined;
    }
  }
  // o que o cliente fez, no histórico (sem repetir)
  const vistos = new Set((t.historico || []).map(chaveDoEvento));
  const novos: EventoDoTicket[] = [];
  const somar = (e: EventoDoTicket) => { const k = chaveDoEvento(e); if (!vistos.has(k)) { vistos.add(k); novos.push(e); } };
  for (const l of links) if (l.abertoEm) somar({ em: l.abertoEm, tipo: 'aberto' });
  if (respondidoEm && respondidoEm !== t.respondidoEm) somar({ em: respondidoEm, tipo: 'respondido' });
  for (const a of arquivos) if (!t.arquivos.some(x => x.id === a.id) && a.enviadoEm) somar({ em: a.enviadoEm, tipo: 'arquivo', texto: a.nome });
  const historico = [...(t.historico || []), ...novos].sort((a, b) => a.em.localeCompare(b.em));
  const saida: Ticket = { ...t, links, arquivos, respostas, historico };
  if (respondidoEm) saida.respondidoEm = respondidoEm; else delete saida.respondidoEm;
  if (revisao) saida.revisao = revisao; else delete saida.revisao;
  return saida;
}

/** As chaves que o item responde, para conferir o que o documento traz (exportada para o formulário do banco). */
export const chavesDosItens = (itens: readonly ItemDoTicket[]): string[] => itens.flatMap(chavesDoItem);
