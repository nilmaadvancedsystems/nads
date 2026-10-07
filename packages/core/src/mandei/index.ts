// @nads/core/mandei — os tickets que o escritório manda ao cliente (Vitor, 07/10/2026). Um ticket é um formulário
// com um link: o cliente responde cada item selecionando, digitando ou anexando arquivos. O 1º link vale 3 dias úteis;
// vencido sem arquivo, sai um 2º link de 5 dias corridos; vencido o 2º sem arquivo, o colaborador liga para o cliente.
// Cada ticket tem um número (#0001) de controle interno. Os textos e as seleções ficam no banco; os arquivos vão para o
// Drive (pelo robô, na pasta do Claudio Secretário). TypeScript puro: quem chama guarda e manda o e-mail.

/**
 * Uma linha do lançamento do item, já no formato da tela (Vitor, 07/10/2026: "Data, nota fiscal, descrição, valor";
 * "se foi uma nota em aberto, qual a data e o número da nota? Se for um pagamento solto, qual a data, o banco?").
 * tipo: a nota em aberto, o pagamento sem nota (com a conta: o banco), a devolução ou só o saldo (sem o razão).
 */
export interface LinhaDoItem { data: string; nf: string; descricao: string; valor: string; tipo?: 'nota' | 'pagamento' | 'devolucao' | 'saldo'; conta?: string }

/** Um item do formulário: o que perguntamos (ex.: um cliente com saldo em aberto, os lançamentos e a nossa pergunta). */
export interface ItemDoTicket { id: string; titulo: string; valor?: string; detalhe?: string; linhas?: LinhaDoItem[]; opcoes: string[] }

export type StatusDoArquivo = 'subindo' | 'na-fila' | 'no-drive' | 'erro';
/** Um arquivo que o cliente anexou (o arquivo em si vai para o Drive; aqui, o nome e o andamento). */
export interface ArquivoDoTicket { id: string; nome: string; tamanho: number; itemId?: string; enviadoEm: string; status: StatusDoArquivo; envioId?: string; erro?: string }

/** A resposta de um item: a opção escolhida e/ou o texto. */
export interface RespostaDoItem { opcao?: string; texto?: string }

/** Um link do ticket: o 1º (3 dias úteis) ou o 2º (5 dias corridos). O código é o segredo do link. */
export interface LinkDoTicket {
  codigo: string; numero: 1 | 2; criadoEm: string; validoAte: string;
  /** o pedido de e-mail ao robô e quando ele enviou */
  emailId?: string; enviadoEm?: string; erroDoEmail?: string;
  /** a primeira vez que o cliente abriu o link */
  abertoEm?: string;
}

export interface Ticket {
  id: string;
  numero: number;
  empresa: { nome: string; codigo: number | null };
  para: { nome: string; email: string };
  assunto: string;
  /** a mensagem do topo do formulário */
  mensagem: string;
  criadoEm: string;
  criadoPor: { nome: string; uid?: string };
  /** de onde saiu (a etapa da Tarefa): o Resolver volta para lá */
  origem: { titulo: string; rota: string; competencia?: string };
  itens: ItemDoTicket[];
  links: LinkDoTicket[];
  respostas: Record<string, RespostaDoItem>;
  arquivos: ArquivoDoTicket[];
  /** o cliente mandou o formulário (a última vez) */
  respondidoEm?: string;
  resolvidoEm?: string;
  resolvidoPor?: string;
}

/**
 * Aguardando (o 1º link valendo) · Segundo link (o 1º venceu sem arquivo: sai o 2º) · Aguardando 2º link · Ligar (o 2º
 * venceu sem arquivo) · Respondido (o cliente anexou: falta o colaborador resolver) · Resolvido.
 */
export type SituacaoDoTicket = 'aguardando' | 'segundo-link' | 'aguardando-2' | 'ligar' | 'respondido' | 'resolvido';

export const ROTULO_DA_SITUACAO: Record<SituacaoDoTicket, string> = {
  aguardando: 'Aguardando', 'segundo-link': 'Gerar 2º link', 'aguardando-2': 'Aguardando (2º link)',
  ligar: 'Ligar para o cliente', respondido: 'Respondido', resolvido: 'Resolvido',
};

/** As respostas prontas que o cliente escolhe em cada item (dá para digitar e anexar também). */
export const OPCOES_PADRAO = [
  'Já foi pago (envio o comprovante)',
  'Foi pago em dinheiro',
  'Foi pago de outra conta',
  'Não reconheço este valor',
  'Outro (explico abaixo)',
];

export const PRAZO_DO_1O_LINK_DIAS_UTEIS = 3;
export const PRAZO_DO_2O_LINK_DIAS = 5;

// ─── datas ────────────────────────────────────────────────────────────────────

/** Os feriados nacionais (as datas móveis de 2026 e 2027: Carnaval, Sexta-feira Santa e Corpus Christi). */
const FERIADOS = new Set([
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25',
  '2026-02-16', '2026-02-17', '2026-04-03', '2026-06-04',
  '2027-02-08', '2027-02-09', '2027-03-26', '2027-05-27',
]);

const dia = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export function diaUtil(d: Date): boolean {
  const s = dia(d);
  return d.getDay() !== 0 && d.getDay() !== 6 && !FERIADOS.has(s) && !FERIADOS.has(s.slice(5));
}

/** O fim do dia útil n (contando a partir do dia seguinte), no horário local, em ISO. */
export function somarDiasUteis(de: Date, n: number): Date {
  const d = new Date(de.getFullYear(), de.getMonth(), de.getDate());
  let faltam = n;
  while (faltam > 0) {
    d.setDate(d.getDate() + 1);
    if (diaUtil(d)) faltam--;
  }
  d.setHours(23, 59, 59, 0);
  return d;
}

/** O fim do dia n dias corridos depois. */
export function somarDias(de: Date, n: number): Date {
  const d = new Date(de.getFullYear(), de.getMonth(), de.getDate() + n);
  d.setHours(23, 59, 59, 0);
  return d;
}

// ─── o ticket ─────────────────────────────────────────────────────────────────

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** O código do link (o segredo): 24 letras e números, de um gerador aleatório (crypto.getRandomValues). */
export function codigoDoLink(aleatorio: (n: number) => Uint8Array): string {
  return Array.from(aleatorio(24), b => ALFABETO[b % ALFABETO.length]).join('');
}

export const rotuloDoNumero = (n: number) => '#' + String(n).padStart(4, '0');

export interface DadosDoTicket {
  empresa: Ticket['empresa']; para: Ticket['para']; assunto: string; mensagem: string;
  criadoPor: Ticket['criadoPor']; origem: Ticket['origem']; itens: ItemDoTicket[];
}

/** O ticket novo, com o 1º link (3 dias úteis). O id e o número vêm de quem guarda. */
export function novoTicket(d: DadosDoTicket, id: string, numero: number, codigo: string, agora: Date): Ticket {
  return {
    id, numero, ...d, criadoEm: agora.toISOString(),
    links: [{ codigo, numero: 1, criadoEm: agora.toISOString(), validoAte: somarDiasUteis(agora, PRAZO_DO_1O_LINK_DIAS_UTEIS).toISOString() }],
    respostas: {}, arquivos: [],
  };
}

export const linkAtual = (t: Ticket): LinkDoTicket => t.links[t.links.length - 1];

export function situacaoDoTicket(t: Ticket, agora: Date): SituacaoDoTicket {
  if (t.resolvidoEm) return 'resolvido';
  if (t.arquivos.some(a => a.status !== 'erro')) return 'respondido';
  const l = linkAtual(t);
  if (agora.getTime() <= new Date(l.validoAte).getTime()) return l.numero === 1 ? 'aguardando' : 'aguardando-2';
  return l.numero === 1 ? 'segundo-link' : 'ligar';
}

/** O 2º link (5 dias corridos): só quando o 1º venceu sem arquivo. */
export function comSegundoLink(t: Ticket, codigo: string, agora: Date): Ticket {
  if (situacaoDoTicket(t, agora) !== 'segundo-link') return t;
  return { ...t, links: [...t.links, { codigo, numero: 2, criadoEm: agora.toISOString(), validoAte: somarDias(agora, PRAZO_DO_2O_LINK_DIAS).toISOString() }] };
}

const noLink = (t: Ticket, codigo: string, f: (l: LinkDoTicket) => LinkDoTicket): Ticket => ({ ...t, links: t.links.map(l => (l.codigo === codigo ? f(l) : l)) });

export function linkEnviado(t: Ticket, codigo: string, quando: Date, emailId?: string): Ticket {
  return noLink(t, codigo, l => ({ ...l, enviadoEm: quando.toISOString(), ...(emailId ? { emailId } : {}) }));
}

/** O link vale? (o código é o atual e não venceu; ticket resolvido não aceita mais nada) */
export function linkValido(t: Ticket, codigo: string, agora: Date): boolean {
  const l = linkAtual(t);
  return !t.resolvidoEm && l.codigo === codigo && agora.getTime() <= new Date(l.validoAte).getTime();
}

/** O cliente abriu o link (a primeira vez fica). */
export function linkAberto(t: Ticket, codigo: string, agora: Date): Ticket {
  return noLink(t, codigo, l => (l.abertoEm ? l : { ...l, abertoEm: agora.toISOString() }));
}

/** O cliente mandou as respostas (só dos itens do ticket; sem campo vazio). */
export function responder(t: Ticket, respostas: Record<string, RespostaDoItem>, agora: Date): Ticket {
  const certas: Record<string, RespostaDoItem> = {};
  for (const it of t.itens) {
    const r = respostas[it.id];
    if (!r) continue;
    const opcao = r.opcao && it.opcoes.includes(r.opcao) ? r.opcao : undefined;
    const texto = r.texto?.trim().slice(0, 2000) || undefined;
    if (opcao || texto) certas[it.id] = { ...(opcao ? { opcao } : {}), ...(texto ? { texto } : {}) };
  }
  return { ...t, respostas: { ...t.respostas, ...certas }, respondidoEm: agora.toISOString() };
}

export function comArquivo(t: Ticket, a: ArquivoDoTicket): Ticket {
  return { ...t, arquivos: [...t.arquivos.filter(x => x.id !== a.id), a] };
}

export function resolver(t: Ticket, por: string, agora: Date): Ticket {
  return { ...t, resolvidoEm: agora.toISOString(), resolvidoPor: por };
}

// ─── o que o cliente vê ──────────────────────────────────────────────────────

/** O formulário do cliente: só o que ele precisa ver (nada do controle interno). */
export interface VistaDoCliente {
  numero: string; empresa: string; mensagem: string; itens: ItemDoTicket[]; respostas: Record<string, RespostaDoItem>;
  arquivos: { nome: string; itemId?: string }[]; validoAte: string; respondidoEm?: string;
}

export function vistaDoCliente(t: Ticket): VistaDoCliente {
  return {
    numero: rotuloDoNumero(t.numero), empresa: t.empresa.nome, mensagem: t.mensagem, itens: t.itens, respostas: t.respostas,
    arquivos: t.arquivos.filter(a => a.status !== 'erro').map(a => ({ nome: a.nome, ...(a.itemId ? { itemId: a.itemId } : {}) })),
    validoAte: linkAtual(t).validoAte, ...(t.respondidoEm ? { respondidoEm: t.respondidoEm } : {}),
  };
}

// ─── o e-mail ────────────────────────────────────────────────────────────────

const dataBR = (iso: string) => { const d = new Date(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };

/** O e-mail com o link (o 1º ou o 2º), em texto: o robô do Entregas monta e envia. */
export function emailDoLink(t: Ticket, link: LinkDoTicket, urlDoLink: string): { assunto: string; corpo: string } {
  const segundo = link.numero === 2;
  return {
    assunto: (segundo ? 'Lembrete: ' : '') + t.assunto + ' — ' + rotuloDoNumero(t.numero),
    corpo: [
      'Olá' + (t.para.nome ? ', ' + t.para.nome : '') + '!',
      '',
      segundo ? 'Ainda não recebemos os arquivos do pedido abaixo. Este é um novo link:' : t.mensagem,
      '',
      'Responda e anexe os arquivos por este link (vale até ' + dataBR(link.validoAte) + '):',
      urlDoLink,
      '',
      'Obrigado!',
      'Nilma Contabilidade',
    ].join('\n'),
  };
}
