// @nads/core/mandei — os tickets que o escritório manda ao cliente (Vitor, 07/10/2026). Um ticket é um formulário
// com um link: o cliente responde cada item selecionando, digitando ou anexando arquivos. O 1º link vale 3 dias úteis;
// vencido sem arquivo, sai um 2º link de 5 dias corridos; vencido o 2º sem arquivo, o colaborador liga para o cliente.
// Cada ticket tem um número (#0001) de controle interno. Os textos e as seleções ficam no banco; os arquivos vão para o
// Drive (pelo robô, na pasta do Claudio Secretário). TypeScript puro: quem chama guarda e manda o e-mail.

/**
 * Uma linha do lançamento do item, já no formato da tela (Vitor, 07/10/2026: "Data, nota fiscal, descrição, valor";
 * "se foi uma nota em aberto, qual a data e o número da nota? Se for um pagamento solto, qual a data, o banco?").
 * tipo: a nota em aberto, o pagamento sem nota (com a conta: o banco), a devolução ou só o saldo (sem o razão).
 * operacao: o que o cliente vê na coluna Operação (Venda, Compra, Recebimento, Pagamento, Devolução; Vitor, 08/10/2026).
 */
export interface LinhaDoItem { data: string; nf: string; descricao: string; valor: string; tipo?: 'nota' | 'pagamento' | 'devolucao' | 'saldo'; operacao?: string; conta?: string }

/** A operação da linha; nos tickets de antes (sem ela), pela descrição ou pelo tipo. */
export function operacaoDaLinha(l: LinhaDoItem): string {
  if (l.operacao) return l.operacao;
  if (/compra/i.test(l.descricao)) return 'Compra';
  if (/venda/i.test(l.descricao)) return 'Venda';
  return l.tipo === 'devolucao' ? 'Devolução' : l.tipo === 'pagamento' ? 'Pagamento' : '—';
}

/** Um item do formulário: o que perguntamos (ex.: um cliente com saldo em aberto, os lançamentos e a nossa pergunta). */
export interface ItemDoTicket { id: string; titulo: string; valor?: string; detalhe?: string; linhas?: LinhaDoItem[]; opcoes: string[] }

export type StatusDoArquivo = 'subindo' | 'na-fila' | 'no-drive' | 'erro';
/** Um arquivo que o cliente anexou (o arquivo em si vai para o Drive; aqui, o nome e o andamento). */
export interface ArquivoDoTicket { id: string; nome: string; tamanho: number; itemId?: string; enviadoEm: string; status: StatusDoArquivo; envioId?: string; erro?: string }

/** A resposta de um item (ou de uma linha dele): a opção escolhida e/ou o texto. */
export interface RespostaDoItem { opcao?: string; texto?: string }

// O cliente responde por linha (Vitor, 08/10/2026: "ela responde por linha"): a resposta e o arquivo de cada lançamento
// ficam na chave '<item>/<n>' (n = a posição da linha); o item sem linhas responde inteiro, na chave dele.
export const chaveDaLinha = (itemId: string, n: number): string => itemId + '/' + n;
/** O item de uma chave (a resposta ou o arquivo de uma linha é do item dela). */
export const itemDaChave = (chave: string): string => chave.split('/')[0];
/** As chaves que o item responde: uma por linha; sem linhas, a do próprio item. */
export const chavesDoItem = (it: Pick<ItemDoTicket, 'id' | 'linhas'>): string[] => (it.linhas?.length ? it.linhas.map((_, n) => chaveDaLinha(it.id, n)) : [it.id]);

/** Um link do ticket: o 1º (3 dias úteis) ou o 2º (5 dias corridos). O código é o segredo do link. */
export interface LinkDoTicket {
  codigo: string; numero: 1 | 2; criadoEm: string; validoAte: string;
  /** o pedido de e-mail ao robô e quando ele enviou */
  emailId?: string; enviadoEm?: string; erroDoEmail?: string;
  /** a primeira vez que o cliente abriu o link */
  abertoEm?: string;
  /** o link da volta (11/11/2026): o escritório pediu para refazer respostas; vale 3 dias úteis, como um 1º link */
  refazer?: boolean;
}

/**
 * A revisão de uma resposta pelo escritório (11/11/2026, no padrão do Content Snare e do Onvio: aprovar ou pedir de novo,
 * com o motivo). Aceita: confere. Refazer: a resposta volta ao cliente com o motivo, até ele responder de novo.
 */
export interface RevisaoDaResposta { estado: 'aceita' | 'refazer'; motivo?: string; por: string; em: string }

/** O que aconteceu com o ticket (o histórico da central, 11/11/2026). */
export type TipoDeEvento = 'criado' | 'enviado' | 'aberto' | 'respondido' | 'arquivo' | 'segundo-link' | 'aceita' | 'refazer' | 'resolvido';
export interface EventoDoTicket { em: string; tipo: TipoDeEvento; por?: string; texto?: string }
export const ROTULO_DO_EVENTO: Record<TipoDeEvento, string> = {
  criado: 'Ticket criado', enviado: 'Link enviado', aberto: 'O cliente abriu o link', respondido: 'O cliente enviou as respostas',
  arquivo: 'O cliente anexou um arquivo', 'segundo-link': '2º link gerado', aceita: 'Respostas aceitas', refazer: 'Pedido para refazer', resolvido: 'Resolvido',
};

/** Uma nota interna do escritório no ticket (o cliente não vê). */
export interface NotaDoTicket { texto: string; por: string; em: string }

export interface Ticket {
  id: string;
  numero: number;
  empresa: { nome: string; codigo: number | null };
  /** o e-mail e o WhatsApp da empresa (os do Cadastro): o link vai pelos dois (Vitor, 07/10/2026) */
  para: { nome: string; email: string; whatsapp?: string };
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
  /** a última vez que o formulário guardou o rascunho (o cliente ainda não mandou) */
  rascunhoEm?: string;
  resolvidoEm?: string;
  resolvidoPor?: string;
  /** a revisão de cada resposta (a chave da linha, ou a do item sem linhas) */
  revisao?: Record<string, RevisaoDaResposta>;
  notas?: NotaDoTicket[];
  historico?: EventoDoTicket[];
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

/** O campo de explicação só abre no "Outro" e no "Foi pago de outra conta" (Vitor, 07/10/2026); e no "Respondo abaixo". */
export const pedeExplicacao = (opcao: string): boolean => /^outro|^foi pago de outra conta|^respondo abaixo/i.test(opcao.trim());

/** O anexar só abre em "Já foi pago" e "Foi pago de outra conta" (Vitor, 07/10/2026); e no "Envio o arquivo". */
export const pedeComprovante = (opcao: string): boolean => /^já foi pago|^foi pago de outra conta|^envio o arquivo/i.test(opcao.trim());

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

/** Um evento a mais no histórico. */
export function comEvento(t: Ticket, e: EventoDoTicket): Ticket {
  return { ...t, historico: [...(t.historico || []), e] };
}

/** O ticket novo, com o 1º link (3 dias úteis). O id e o número vêm de quem guarda. */
export function novoTicket(d: DadosDoTicket, id: string, numero: number, codigo: string, agora: Date): Ticket {
  return {
    id, numero, ...d, criadoEm: agora.toISOString(),
    links: [{ codigo, numero: 1, criadoEm: agora.toISOString(), validoAte: somarDiasUteis(agora, PRAZO_DO_1O_LINK_DIAS_UTEIS).toISOString() }],
    respostas: {}, arquivos: [],
    historico: [{ em: agora.toISOString(), tipo: 'criado', ...(d.criadoPor.nome ? { por: d.criadoPor.nome } : {}) }],
  };
}

export const linkAtual = (t: Ticket): LinkDoTicket => t.links[t.links.length - 1];

/** O que falta numa resposta: a opção, a explicação (quando a opção pede) ou o comprovante (quando a opção pede). */
export type FaltaNaResposta = 'resposta' | 'explicacao' | 'comprovante';

/** As chaves que ainda não estão completas, com o que falta em cada uma. */
export function faltaNoTicket(t: Pick<Ticket, 'itens' | 'respostas' | 'arquivos'>): { chave: string; falta: FaltaNaResposta }[] {
  const comArquivo = new Set(t.arquivos.filter(a => a.status !== 'erro' && a.itemId).map(a => a.itemId as string));
  const lista: { chave: string; falta: FaltaNaResposta }[] = [];
  for (const it of t.itens) {
    for (const chave of chavesDoItem(it)) {
      const r = t.respostas[chave];
      if (!r?.opcao) lista.push({ chave, falta: 'resposta' });
      else if (pedeExplicacao(r.opcao) && !r.texto?.trim()) lista.push({ chave, falta: 'explicacao' });
      else if (pedeComprovante(r.opcao) && !comArquivo.has(chave)) lista.push({ chave, falta: 'comprovante' });
    }
  }
  return lista;
}

/** As chaves que o escritório pediu para refazer e o cliente ainda não respondeu de novo. */
export const chavesParaRefazer = (t: Pick<Ticket, 'revisao'>): string[] =>
  Object.entries(t.revisao || {}).filter(([, r]) => r.estado === 'refazer').map(([k]) => k);

/** As respostas que o cliente mandou e o escritório ainda não aceitou nem pediu de novo. */
export function chavesParaRevisar(t: Pick<Ticket, 'itens' | 'respostas' | 'revisao' | 'respondidoEm'>): string[] {
  if (!t.respondidoEm) return [];
  return t.itens.flatMap(chavesDoItem).filter(k => !!t.respostas[k] && !t.revisao?.[k]);
}

/**
 * Respondido: o cliente mandou o formulário com tudo completo (11/11/2026: antes só contava com arquivo, e quem respondia
 * "Foi pago em dinheiro" em tudo recebia o 2º link "ainda não recebemos os arquivos"), ou anexou algum arquivo. Com
 * resposta pedida de novo, volta a aguardar o cliente (pelo link da volta).
 */
export function situacaoDoTicket(t: Ticket, agora: Date): SituacaoDoTicket {
  if (t.resolvidoEm) return 'resolvido';
  if (!chavesParaRefazer(t).length) {
    if (t.arquivos.some(a => a.status !== 'erro')) return 'respondido';
    if (t.respondidoEm && !faltaNoTicket(t).length) return 'respondido';
  }
  const l = linkAtual(t);
  if (agora.getTime() <= new Date(l.validoAte).getTime()) return l.numero === 1 ? 'aguardando' : 'aguardando-2';
  return l.numero === 1 ? 'segundo-link' : 'ligar';
}

/** O 2º link (5 dias corridos): só quando o 1º venceu sem arquivo. */
export function comSegundoLink(t: Ticket, codigo: string, agora: Date): Ticket {
  if (situacaoDoTicket(t, agora) !== 'segundo-link') return t;
  return comEvento({ ...t, links: [...t.links, { codigo, numero: 2, criadoEm: agora.toISOString(), validoAte: somarDias(agora, PRAZO_DO_2O_LINK_DIAS).toISOString() }] },
    { em: agora.toISOString(), tipo: 'segundo-link' });
}

const noLink = (t: Ticket, codigo: string, f: (l: LinkDoTicket) => LinkDoTicket): Ticket => ({ ...t, links: t.links.map(l => (l.codigo === codigo ? f(l) : l)) });

export function linkEnviado(t: Ticket, codigo: string, quando: Date, emailId?: string): Ticket {
  const l = t.links.find(x => x.codigo === codigo);
  const enviado = noLink(t, codigo, x => ({ ...x, enviadoEm: quando.toISOString(), ...(emailId ? { emailId } : {}) }));
  return l ? comEvento(enviado, { em: quando.toISOString(), tipo: 'enviado', texto: l.refazer ? 'link da volta' : l.numero + 'º link' }) : enviado;
}

/** O link vale? (o código é o atual e não venceu; ticket resolvido não aceita mais nada) */
export function linkValido(t: Ticket, codigo: string, agora: Date): boolean {
  const l = linkAtual(t);
  return !t.resolvidoEm && l.codigo === codigo && agora.getTime() <= new Date(l.validoAte).getTime();
}

/** O cliente abriu o link (a primeira vez fica). */
export function linkAberto(t: Ticket, codigo: string, agora: Date): Ticket {
  const l = t.links.find(x => x.codigo === codigo);
  if (!l || l.abertoEm) return t;
  return comEvento(noLink(t, codigo, x => ({ ...x, abertoEm: agora.toISOString() })), { em: agora.toISOString(), tipo: 'aberto' });
}

/**
 * As respostas que valem, por chave: só as linhas dos itens do ticket (ou o item sem linhas), a opção que existe no item
 * e o texto até 2.000 letras. A chave mandada vazia fica null (o cliente apagou a resposta).
 */
function respostasQueValem(t: Ticket, respostas: Record<string, RespostaDoItem>): Record<string, RespostaDoItem | null> {
  const certas: Record<string, RespostaDoItem | null> = {};
  for (const it of t.itens) {
    for (const chave of chavesDoItem(it)) {
      const r = respostas[chave];
      if (!r) continue;
      const opcao = r.opcao && it.opcoes.includes(r.opcao) ? r.opcao : undefined;
      const texto = r.texto?.trim().slice(0, 2000) || undefined;
      certas[chave] = opcao || texto ? { ...(opcao ? { opcao } : {}), ...(texto ? { texto } : {}) } : null;
    }
  }
  return certas;
}

function comRespostas(t: Ticket, certas: Record<string, RespostaDoItem | null>): Record<string, RespostaDoItem> {
  const r = { ...t.respostas };
  for (const [k, v] of Object.entries(certas)) { if (v) r[k] = v; else delete r[k]; }
  return r;
}

/**
 * O rascunho (11/11/2026, como o Content Snare e o Typeform: o cliente volta pelo mesmo link e continua): guarda cada
 * resposta enquanto ele preenche, sem dar o formulário como enviado.
 */
export function salvarRascunho(t: Ticket, respostas: Record<string, RespostaDoItem>, agora: Date): Ticket {
  return { ...t, respostas: comRespostas(t, respostasQueValem(t, respostas)), rascunhoEm: agora.toISOString() };
}

/**
 * O cliente mandou as respostas (só das linhas dos itens do ticket, ou do item sem linhas; sem campo vazio). O que o
 * escritório tinha pedido de novo e ele respondeu sai do "refazer" e volta para a revisão.
 */
export function responder(t: Ticket, respostas: Record<string, RespostaDoItem>, agora: Date): Ticket {
  const certas = respostasQueValem(t, respostas);
  const novas = comRespostas(t, certas);
  const revisao = { ...(t.revisao || {}) };
  for (const k of chavesParaRefazer(t)) if (novas[k]?.opcao || novas[k]?.texto) delete revisao[k];
  const semRevisao = !Object.keys(revisao).length;
  const base: Ticket = { ...t, respostas: novas, respondidoEm: agora.toISOString() };
  delete base.revisao;
  return comEvento(semRevisao ? base : { ...base, revisao }, { em: agora.toISOString(), tipo: 'respondido' });
}

export function comArquivo(t: Ticket, a: ArquivoDoTicket): Ticket {
  const novo = !t.arquivos.some(x => x.id === a.id);
  const com = { ...t, arquivos: [...t.arquivos.filter(x => x.id !== a.id), a] };
  return novo ? comEvento(com, { em: a.enviadoEm, tipo: 'arquivo', texto: a.nome }) : com;
}

export function resolver(t: Ticket, por: string, agora: Date): Ticket {
  return comEvento({ ...t, resolvidoEm: agora.toISOString(), resolvidoPor: por }, { em: agora.toISOString(), tipo: 'resolvido', por });
}

// ─── a revisão do escritório (11/11/2026) ────────────────────────────────────

/** Aceita as respostas dessas chaves (as que existem e têm resposta). */
export function aceitar(t: Ticket, chaves: readonly string[], por: string, agora: Date): Ticket {
  const validas = new Set(t.itens.flatMap(chavesDoItem));
  const certas = chaves.filter(k => validas.has(k) && !!t.respostas[k]);
  if (!certas.length) return t;
  const revisao = { ...(t.revisao || {}) };
  for (const k of certas) revisao[k] = { estado: 'aceita', por, em: agora.toISOString() };
  return comEvento({ ...t, revisao }, { em: agora.toISOString(), tipo: 'aceita', por, texto: certas.length === 1 ? '1 resposta' : certas.length + ' respostas' });
}

/**
 * Pede de novo (o "Redo" do Content Snare): cada chave volta ao cliente com o motivo, a resposta dela sai (ele responde
 * de novo) e o ticket ganha o link da volta, com 3 dias úteis, como um 1º link (vencido sem resposta, sai o 2º). O
 * motivo é obrigatório: é o que o cliente lê.
 */
export function pedirDeNovo(t: Ticket, pedidos: readonly { chave: string; motivo: string }[], por: string, codigo: string, agora: Date): Ticket {
  if (t.resolvidoEm) return t;
  const validas = new Set(t.itens.flatMap(chavesDoItem));
  const certos = pedidos.map(p => ({ chave: p.chave, motivo: p.motivo.trim().slice(0, 500) })).filter(p => validas.has(p.chave) && !!p.motivo);
  if (!certos.length) return t;
  const revisao = { ...(t.revisao || {}) };
  const respostas = { ...t.respostas };
  for (const p of certos) {
    revisao[p.chave] = { estado: 'refazer', motivo: p.motivo, por, em: agora.toISOString() };
    delete respostas[p.chave];
  }
  const base: Ticket = {
    ...t, revisao, respostas,
    links: [...t.links, { codigo, numero: 1, refazer: true, criadoEm: agora.toISOString(), validoAte: somarDiasUteis(agora, PRAZO_DO_1O_LINK_DIAS_UTEIS).toISOString() }],
  };
  delete base.respondidoEm;
  return comEvento(base, { em: agora.toISOString(), tipo: 'refazer', por, texto: certos.length === 1 ? '1 resposta' : certos.length + ' respostas' });
}

/** Uma nota interna (o cliente não vê). */
export function comNota(t: Ticket, texto: string, por: string, agora: Date): Ticket {
  const limpo = texto.trim().slice(0, 2000);
  return limpo ? { ...t, notas: [...(t.notas || []), { texto: limpo, por, em: agora.toISOString() }] } : t;
}

// ─── o que o cliente vê ──────────────────────────────────────────────────────

/** O formulário do cliente: só o que ele precisa ver (nada do controle interno). */
export interface VistaDoCliente {
  numero: string; empresa: string; mensagem: string; itens: ItemDoTicket[]; respostas: Record<string, RespostaDoItem>;
  arquivos: { nome: string; itemId?: string }[]; validoAte: string; respondidoEm?: string;
  /** o que o escritório pediu de novo: a chave e o motivo */
  refazer: Record<string, string>;
}

export function vistaDoCliente(t: Ticket): VistaDoCliente {
  return {
    numero: rotuloDoNumero(t.numero), empresa: t.empresa.nome, mensagem: t.mensagem, itens: t.itens, respostas: t.respostas,
    arquivos: t.arquivos.filter(a => a.status !== 'erro').map(a => ({ nome: a.nome, ...(a.itemId ? { itemId: a.itemId } : {}) })),
    validoAte: linkAtual(t).validoAte, ...(t.respondidoEm ? { respondidoEm: t.respondidoEm } : {}),
    refazer: Object.fromEntries(chavesParaRefazer(t).map(k => [k, t.revisao?.[k]?.motivo || ''])),
  };
}

/** Um ticket esperando o cliente, para a Área do Cliente (11/11/2026: o que o escritório pede, num lugar só). */
export interface TicketNaArea {
  codigo: string; numero: string; assunto: string; validoAte: string;
  /** quantas respostas o formulário tem e quantas faltam */
  total: number; faltam: number;
  /** quantas o escritório pediu de novo */
  refazer: number;
}

/**
 * Os tickets das empresas do link que esperam o cliente (o link atual valendo, ainda sem resposta completa), o que vence
 * primeiro antes. Respondido, resolvido ou com o link vencido não aparece (o vencido gera o 2º link, que aparece).
 */
export function ticketsDaArea(tickets: readonly Ticket[], codigos: readonly number[], agora: Date): TicketNaArea[] {
  return tickets
    .filter(t => t.empresa.codigo != null && codigos.includes(t.empresa.codigo))
    .filter(t => { const s = situacaoDoTicket(t, agora); return s === 'aguardando' || s === 'aguardando-2'; })
    .map(t => {
      const l = linkAtual(t);
      return { codigo: l.codigo, numero: rotuloDoNumero(t.numero), assunto: t.assunto, validoAte: l.validoAte, total: t.itens.flatMap(chavesDoItem).length, faltam: faltaNoTicket(t).length, refazer: chavesParaRefazer(t).length };
    })
    .sort((a, b) => a.validoAte.localeCompare(b.validoAte));
}

// ─── o e-mail ────────────────────────────────────────────────────────────────

const dataBR = (iso: string) => { const d = new Date(iso); return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); };

/** O e-mail com o link (o 1º, o 2º ou o da volta), em texto: o robô do Entregas monta e envia. */
export function emailDoLink(t: Ticket, link: LinkDoTicket, urlDoLink: string): { assunto: string; corpo: string } {
  const segundo = link.numero === 2;
  const refazer = chavesParaRefazer(t).length;
  return {
    assunto: (link.refazer ? 'Falta pouco: ' : segundo ? 'Lembrete: ' : '') + t.assunto + ' — ' + rotuloDoNumero(t.numero),
    corpo: [
      'Olá' + (t.para.nome ? ', ' + t.para.nome : '') + '!',
      '',
      link.refazer
        ? 'Conferimos as suas respostas e precisamos que veja de novo ' + (refazer === 1 ? '1 delas' : refazer + ' delas') + ' (o motivo está no formulário).'
        : segundo ? 'Ainda não recebemos a sua resposta do pedido abaixo. Este é um novo link:' : t.mensagem,
      '',
      'Responda e anexe os arquivos por este link (vale até ' + dataBR(link.validoAte) + '):',
      urlDoLink,
      '',
      'Obrigado!',
      'Nilma Contabilidade',
    ].join('\n'),
  };
}

export * from './modelos';
