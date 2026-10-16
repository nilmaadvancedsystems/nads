// A entrega de documentos aos clientes, trazida do Entregas para o nads (16/10/2026: "quero integrar no app … o entregas,
// só que preciso que fique tudo no visual igual"; "quero só a parte de entregas, o resto tanto faz"). As regras puras da
// rota e do painel, as MESMAS do entregas.html, sobre os MESMOS documentos do banco do Entregas:
//   entregas/{id}  { clienteId|null, clienteNome, avulso, banco|null, competencia 'AAAA-MM', vencimento 'AAAA-MM-DD'|'',
//                    itens [{tipo, valor|null, funcionario?}], zona, recebedor, temAssinatura, temFoto, temGuia, falha,
//                    motivoFalha, semAssinatura, motivoSemAssinatura, entregadoPor (e-mail), entregadoPorNome,
//                    status 'pendente' (na rota) | 'link' (no link do cliente) | 'confirmada' | 'falha',
//                    criadoEm, confirmadoEm|null, ordemRota?, tentativa?, motivoTentativaAnterior? }
//   entregas/{id}/anexos/comprovante  { assinatura?: data URL (PNG), foto?: data URL (JPEG) }
//   clientes/{id}  { nome, codigoOrigem, documento, telefone, ativo, entrega (é cliente do Entregas), zona, grupoLocal }
//   config/rotaPadrao  { zonas: {clienteId: zona}, ordem: {clienteId: n} } (a ordem fixa do escritório)

export type StatusDaEntrega = 'pendente' | 'link' | 'confirmada' | 'falha';
export type Zona = 'superior' | 'central' | 'inferior';

/** As regiões da rota (os rótulos do Entregas). */
export const ZONAS: readonly { valor: Zona; rotulo: string }[] = [
  { valor: 'superior', rotulo: 'Parte superior' },
  { valor: 'central', rotulo: 'Central' },
  { valor: 'inferior', rotulo: 'Parte inferior' },
];
export const rotuloDaZona = (z: string) => ZONAS.find(x => x.valor === z)?.rotulo || '';

/** Os documentos que se entregam (a lista do Entregas; os sem valor não pedem o R$). */
export interface TipoDeDocumento { chave: string; rotulo: string; semValor?: boolean; pedeFuncionario?: boolean }
export const TIPOS_DE_DOCUMENTO: readonly TipoDeDocumento[] = [
  { chave: 'das', rotulo: 'DAS' },
  { chave: 'icms_antecipado', rotulo: 'ICMS Antec.' },
  { chave: 'icms_difal', rotulo: 'ICMS Dif. Alíq.' },
  { chave: 'icms_st', rotulo: 'ICMS ST' },
  { chave: 'fgts', rotulo: 'FGTS' },
  { chave: 'darf', rotulo: 'DARF' },
  { chave: 'dae', rotulo: 'DAE' },
  { chave: 'honorario', rotulo: 'Honorário', semValor: true },
  { chave: 'notas', rotulo: 'Notas', semValor: true },
  { chave: 'boleto', rotulo: 'Boleto' },
  { chave: 'ccir', rotulo: 'CCIR', semValor: true },
  { chave: 'multa_rescisoria', rotulo: 'Multa Rescisória', pedeFuncionario: true },
  { chave: 'ferias', rotulo: 'Férias' },
  { chave: 'folha_pagamento', rotulo: 'Folha de Pagamento', semValor: true },
  { chave: 'prolabore', rotulo: 'Prólabore', semValor: true },
  { chave: 'esocial', rotulo: 'eSocial', semValor: true },
];

/** Os motivos de "não entregue" num toque (os do Entregas). */
export const MOTIVOS_DE_FALHA: readonly string[] = ['Estabelecimento fechado', 'Cliente ausente', 'Ninguém atendeu', 'Recusou receber', 'Endereço errado', 'Mudou de endereço', 'Pediu pra voltar outro dia'];

export interface ItemDaEntrega { tipo: string; valor: number | null; funcionario?: string }

export interface Entrega {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  avulso: boolean;
  banco: string | null;
  competencia: string;
  vencimento: string;
  itens: ItemDaEntrega[];
  zona: string;
  recebedor: string;
  temAssinatura: boolean;
  temFoto: boolean;
  temGuia: boolean;
  falha: boolean;
  motivoFalha: string;
  semAssinatura: boolean;
  motivoSemAssinatura: string;
  recebidoPeloLink: boolean;
  entregadoPor: string;
  entregadoPorNome: string;
  status: StatusDaEntrega;
  criadoEm: string;
  confirmadoEm: string | null;
  ordemRota: number | null;
  tentativa: number;
  motivoTentativaAnterior: string;
}

export interface ClienteDaRota {
  id: string;
  nome: string;
  codigoOrigem: string;
  documento: string;
  telefone: string;
  ativo: boolean;
  /** é cliente do Entregas (o app marca na primeira entrega) */
  entrega: boolean;
  zona: string;
  /** empresas no mesmo endereço: uma parada só */
  grupoLocal: string;
}

export interface RotaPadrao { zonas: Record<string, string>; ordem: Record<string, number> }
export const ROTA_PADRAO_VAZIA: RotaPadrao = { zonas: {}, ordem: {} };

const texto = (v: unknown) => (v == null ? '' : String(v));
const STATUS: readonly StatusDaEntrega[] = ['pendente', 'link', 'confirmada', 'falha'];

/** O item como está no banco (as entregas antigas guardavam só o nome do documento). */
function itemDoBanco(i: unknown): ItemDaEntrega | null {
  if (typeof i === 'string') return i ? { tipo: i, valor: null } : null;
  if (!i || typeof i !== 'object') return null;
  const o = i as Record<string, unknown>;
  const tipo = texto(o.tipo);
  if (!tipo) return null;
  const valor = typeof o.valor === 'number' && Number.isFinite(o.valor) ? o.valor : null;
  return o.funcionario ? { tipo, valor, funcionario: texto(o.funcionario) } : { tipo, valor };
}

export function entregaDoDocumento(id: string, d: Record<string, unknown>): Entrega {
  return {
    id,
    clienteId: d.clienteId ? texto(d.clienteId) : null,
    clienteNome: texto(d.clienteNome),
    avulso: !!d.avulso,
    banco: d.banco ? texto(d.banco) : null,
    competencia: texto(d.competencia),
    vencimento: texto(d.vencimento),
    itens: Array.isArray(d.itens) ? d.itens.map(itemDoBanco).filter((x): x is ItemDaEntrega => !!x) : [],
    zona: texto(d.zona),
    recebedor: texto(d.recebedor),
    temAssinatura: !!d.temAssinatura,
    temFoto: !!d.temFoto,
    temGuia: !!d.temGuia,
    falha: !!d.falha,
    motivoFalha: texto(d.motivoFalha),
    semAssinatura: !!d.semAssinatura,
    motivoSemAssinatura: texto(d.motivoSemAssinatura),
    recebidoPeloLink: !!d.recebidoPeloLink,
    entregadoPor: texto(d.entregadoPor),
    entregadoPorNome: texto(d.entregadoPorNome),
    status: STATUS.includes(d.status as StatusDaEntrega) ? (d.status as StatusDaEntrega) : 'pendente',
    criadoEm: texto(d.criadoEm),
    confirmadoEm: d.confirmadoEm ? texto(d.confirmadoEm) : null,
    ordemRota: typeof d.ordemRota === 'number' ? d.ordemRota : null,
    tentativa: typeof d.tentativa === 'number' && d.tentativa > 1 ? d.tentativa : 1,
    motivoTentativaAnterior: texto(d.motivoTentativaAnterior),
  };
}

export function clienteDaRotaDoDocumento(id: string, d: Record<string, unknown>): ClienteDaRota {
  return {
    id, nome: texto(d.nome), codigoOrigem: texto(d.codigoOrigem), documento: texto(d.documento), telefone: texto(d.telefone),
    ativo: d.ativo !== false, entrega: d.entrega === true, zona: texto(d.zona), grupoLocal: texto(d.grupoLocal),
  };
}

export function rotaPadraoDoDocumento(d: Record<string, unknown> | null | undefined): RotaPadrao {
  if (!d) return ROTA_PADRAO_VAZIA;
  const zonas: Record<string, string> = {};
  const ordem: Record<string, number> = {};
  for (const [k, v] of Object.entries((d.zonas as Record<string, unknown>) || {})) if (typeof v === 'string') zonas[k] = v;
  for (const [k, v] of Object.entries((d.ordem as Record<string, unknown>) || {})) if (typeof v === 'number') ordem[k] = v;
  return { zonas, ordem };
}

/** "123 - NOME DO CLIENTE" (o rótulo do Entregas; também é o clienteNome gravado na entrega). */
export const rotuloDoCliente = (c: Pick<ClienteDaRota, 'codigoOrigem' | 'nome'>) => (c.codigoOrigem ? c.codigoOrigem + ' - ' : '') + c.nome;

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A busca do Entregas: nome (sem acento), código, ou parte do CNPJ/CPF (3 dígitos ou mais, com ou sem pontuação). */
export function clienteCombina(c: Pick<ClienteDaRota, 'nome' | 'codigoOrigem' | 'documento'>, busca: string): boolean {
  const q = semAcento(busca.trim());
  if (!q) return true;
  const digitos = q.replace(/\D/g, '');
  return semAcento(c.nome).includes(q) || semAcento(c.codigoOrigem).includes(q)
    || (digitos.length >= 3 && c.documento.replace(/\D/g, '').includes(digitos));
}

/** "1.234,56", "1234.56", "R$ 80" → número; vazio ou ruim → null. */
export function valorDigitado(s: string): number | null {
  let t = s.replace(/[R$\s]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

export const totalDosItens = (itens: readonly ItemDaEntrega[]) => Math.round(itens.reduce((s, i) => s + (i.valor || 0), 0) * 100) / 100;
export const textoDosItens = (itens: readonly ItemDaEntrega[]) => itens.map(i => i.tipo).join(', ');

/** A data em que a entrega aconteceu (ou foi posta na rota). */
export const quandoFoi = (e: Pick<Entrega, 'confirmadoEm' | 'criadoEm'>) => e.confirmadoEm || e.criadoEm;

// ---------------------------------------------------------------------------------------------------------------------
// o painel: a situação de cada cliente na competência
// ---------------------------------------------------------------------------------------------------------------------
export type SituacaoNoMes = 'entregue' | 'rota' | 'falha' | 'sem_entrega';
export type FiltroDoPainel = 'com_entrega' | 'entregue' | 'rota' | 'falha' | 'sem_entrega' | 'todos';
export const FILTROS_DO_PAINEL: readonly { valor: FiltroDoPainel; rotulo: string }[] = [
  { valor: 'com_entrega', rotulo: 'Com movimento' },
  { valor: 'entregue', rotulo: 'Entregues' },
  { valor: 'rota', rotulo: 'Na rota' },
  { valor: 'falha', rotulo: 'Não entregues' },
  { valor: 'sem_entrega', rotulo: 'Sem entrega' },
  { valor: 'todos', rotulo: 'Todos' },
];

/** O rótulo e o tom (do .badge) da situação; "No link" quando a última está no link do cliente. */
export function rotuloDaSituacao(s: SituacaoNoMes, ultima?: Pick<Entrega, 'status' | 'recebidoPeloLink'> | null): { rotulo: string; tom: 'ok' | 'warn' | 'bad' | 'neutral' } {
  if (s === 'entregue') return { rotulo: ultima?.recebidoPeloLink ? 'Recebido pelo link' : 'Entregue', tom: 'ok' };
  if (s === 'rota') return { rotulo: ultima?.status === 'link' ? 'No link' : 'Na rota', tom: 'warn' };
  if (s === 'falha') return { rotulo: 'Não entregue', tom: 'bad' };
  return { rotulo: 'Sem entrega', tom: 'neutral' };
}

/** A situação da entrega sozinha (a lista do cliente). */
export function situacaoDaEntrega(e: Pick<Entrega, 'status'>): SituacaoNoMes {
  return e.status === 'confirmada' ? 'entregue' : e.status === 'falha' ? 'falha' : 'rota';
}

/** As entregas da mais nova para a mais velha (pela data em que aconteceram). */
export const maisNovaPrimeiro = <T extends Pick<Entrega, 'confirmadoEm' | 'criadoEm'>>(lista: readonly T[]): T[] =>
  [...lista].sort((a, b) => quandoFoi(b).localeCompare(quandoFoi(a)));

/** A situação do cliente no mês: a da entrega mais nova (como no Painel do Entregas). */
export function situacaoNoMes(entregasDoCliente: readonly Pick<Entrega, 'status' | 'confirmadoEm' | 'criadoEm'>[]): SituacaoNoMes {
  const ultima = maisNovaPrimeiro(entregasDoCliente)[0];
  return ultima ? situacaoDaEntrega(ultima) : 'sem_entrega';
}

const noFiltro = (f: FiltroDoPainel, s: SituacaoNoMes) =>
  f === 'todos' ? true : f === 'com_entrega' ? s !== 'sem_entrega' : f === s;

export interface LinhaDoPainel {
  chave: string;
  /** null = entrega avulsa (sem cadastro) ou do banco */
  cliente: ClienteDaRota | null;
  nome: string;
  situacao: SituacaoNoMes;
  /** as entregas do mês, a mais nova primeiro */
  entregas: Entrega[];
}

/**
 * Os clientes da competência no Painel: sem busca, só os do Entregas (marcados como cliente de entrega, ou com parada na
 * rota; se ninguém foi marcado ainda, todos os ativos); com busca, qualquer cliente ativo. Depois os avulsos do mês.
 */
export function clientesDeEntrega(clientes: readonly ClienteDaRota[], pendentes: readonly Pick<Entrega, 'clienteId'>[]): ClienteDaRota[] {
  const ativos = clientes.filter(c => c.ativo);
  if (!ativos.some(c => c.entrega)) return ativos;
  const naRota = new Set(pendentes.map(e => e.clienteId).filter(Boolean));
  return ativos.filter(c => c.entrega || naRota.has(c.id));
}

export function linhasDoPainel(p: {
  clientes: readonly ClienteDaRota[];
  pendentes: readonly Pick<Entrega, 'clienteId'>[];
  doMes: readonly Entrega[];
  busca: string;
  filtro: FiltroDoPainel;
}): LinhaDoPainel[] {
  const q = p.busca.trim();
  const base = q ? p.clientes.filter(c => c.ativo && clienteCombina(c, q)) : clientesDeEntrega(p.clientes, p.pendentes);
  const porCliente = new Map<string, Entrega[]>();
  for (const e of p.doMes) if (e.clienteId) porCliente.set(e.clienteId, [...(porCliente.get(e.clienteId) || []), e]);
  const linhas: LinhaDoPainel[] = [...base]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(c => {
      const entregas = maisNovaPrimeiro(porCliente.get(c.id) || []);
      return { chave: c.id, cliente: c, nome: rotuloDoCliente(c), situacao: situacaoNoMes(entregas), entregas };
    })
    .filter(l => noFiltro(p.filtro, l.situacao));
  const qa = semAcento(q);
  const avulsas = maisNovaPrimeiro(p.doMes.filter(e => e.avulso && (!qa || semAcento(e.clienteNome).includes(qa))))
    .map(e => ({ chave: 'avulsa-' + e.id, cliente: null, nome: e.clienteNome, situacao: situacaoDaEntrega(e), entregas: [e] }))
    .filter(l => l.situacao !== 'sem_entrega' && noFiltro(p.filtro, l.situacao));
  return [...linhas, ...avulsas];
}

/** Os números do mês: quantos dos clientes do Entregas já receberam, os que estão na rota, os não entregues e os sem entrega. */
export function numerosDoMes(clientesDoMes: readonly ClienteDaRota[], doMes: readonly Entrega[]) {
  const porCliente = new Map<string, Entrega[]>();
  for (const e of doMes) if (e.clienteId) porCliente.set(e.clienteId, [...(porCliente.get(e.clienteId) || []), e]);
  const conta = { total: clientesDoMes.length, entregue: 0, rota: 0, falha: 0, sem_entrega: 0 };
  for (const c of clientesDoMes) conta[situacaoNoMes(porCliente.get(c.id) || [])]++;
  return { ...conta, porcento: conta.total ? Math.round((conta.entregue / conta.total) * 100) : 0 };
}

// ---------------------------------------------------------------------------------------------------------------------
// a rota: a ordem das paradas
// ---------------------------------------------------------------------------------------------------------------------
const ORDEM_DAS_ZONAS: Record<string, number> = { superior: 0, central: 1, inferior: 2 };

/** A parada: empresas no mesmo endereço (grupoLocal) e as várias guias do mesmo cliente contam como uma só. */
export function chaveDaParada(e: Pick<Entrega, 'clienteId' | 'clienteNome'>, clientes: ReadonlyMap<string, ClienteDaRota>): string {
  const c = e.clienteId ? clientes.get(e.clienteId) : undefined;
  return c?.grupoLocal || e.clienteId || e.clienteNome || '?';
}

function posicaoNaRotaFixa(e: Pick<Entrega, 'clienteId' | 'zona'>, fixa: RotaPadrao): number | null {
  if (!e.clienteId) return null;
  const pos = fixa.ordem[e.clienteId];
  if (typeof pos !== 'number') return null;
  const zona = fixa.zonas[e.clienteId] || e.zona || 'central';
  return (ORDEM_DAS_ZONAS[zona] ?? 1) * 1000 + pos;
}

/**
 * A ordem da rota, do mais forte para o mais fraco (a do Entregas): 1. o que alguém pôs na mão (ordemRota); 2. a ordem fixa
 * do escritório (a região e a posição dentro dela); 3. quem entrou primeiro. (O encaixe por proximidade, que precisa do
 * mapa dos clientes, ficou no Entregas.)
 */
export function ordenarParadas<T extends Pick<Entrega, 'ordemRota' | 'clienteId' | 'zona' | 'criadoEm'>>(lista: readonly T[], fixa: RotaPadrao = ROTA_PADRAO_VAZIA): T[] {
  return [...lista].sort((a, b) => {
    const ao = a.ordemRota, bo = b.ordemRota;
    if (ao !== null && bo !== null && ao !== bo) return ao - bo;
    if (ao !== null && bo === null) return -1;
    if (ao === null && bo !== null) return 1;
    const af = posicaoNaRotaFixa(a, fixa), bf = posicaoNaRotaFixa(b, fixa);
    if (af !== null && bf !== null && af !== bf) return af - bf;
    if (af !== null && bf === null) return -1;
    if (af === null && bf !== null) return 1;
    return a.criadoEm.localeCompare(b.criadoEm);
  });
}

/** Mover uma parada uma posição para cima (-1) ou para baixo (+1): a nova ordem (os ids), que vira o ordemRota de cada uma. */
export function moverNaRota(ids: readonly string[], id: string, passo: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const nova = [...ids];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

/** O aviso da parada: a tentativa (a 2ª vez, e o que aconteceu antes). */
export function avisoDaParada(e: Pick<Entrega, 'tentativa' | 'motivoTentativaAnterior'>): string {
  return e.tentativa > 1 ? e.tentativa + 'ª tentativa' + (e.motivoTentativaAnterior ? ' — antes: ' + e.motivoTentativaAnterior : '') : '';
}

// ---------------------------------------------------------------------------------------------------------------------
// registrar e confirmar
// ---------------------------------------------------------------------------------------------------------------------
/** Quem grava: o e-mail da conta (as regras do banco conferem com o login) e o nome. */
export interface QuemEntrega { email: string; nome: string }

export type ParaQuem = { tipo: 'cliente'; cliente: ClienteDaRota } | { tipo: 'avulso'; nome: string } | { tipo: 'banco'; nome: string };

export interface EntregaNova {
  para: ParaQuem;
  competencia: string;
  /** 'AAAA-MM-DD' ou '' */
  vencimento: string;
  itens: ItemDaEntrega[];
  zona: string;
  /** a imagem anexada (a foto, ou a primeira página do PDF da guia) */
  foto: string | null;
  /** a imagem é a da guia (veio de um PDF) */
  fotoEhGuia: boolean;
}

/** O que falta para pôr na rota (as mesmas exigências do formulário do Entregas). */
export function faltasNaEntrega(n: Omit<EntregaNova, 'foto' | 'fotoEhGuia'>): string[] {
  const f: string[] = [];
  if (n.para.tipo === 'cliente' ? !n.para.cliente : !n.para.nome.trim()) f.push(n.para.tipo === 'banco' ? 'qual banco' : 'o cliente');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(n.competencia)) f.push('a competência');
  if (!n.itens.length) f.push('ao menos um documento');
  return f;
}

/** O documento novo da entrega na rota (status 'pendente'), campo a campo como o Entregas grava. */
export function dadosDaEntregaNova(n: EntregaNova, quem: QuemEntrega, agora: string): Record<string, unknown> {
  const p = n.para;
  return {
    clienteId: p.tipo === 'cliente' ? p.cliente.id : null,
    clienteNome: p.tipo === 'cliente' ? rotuloDoCliente(p.cliente) : p.tipo === 'banco' ? 'Banco: ' + p.nome.trim() : p.nome.trim(),
    avulso: p.tipo !== 'cliente',
    banco: p.tipo === 'banco' ? p.nome.trim().slice(0, 80) : null,
    competencia: n.competencia,
    vencimento: n.vencimento || '',
    codigoPagamento: null,
    temGuia: !!(n.fotoEhGuia && n.foto),
    itens: n.itens.map(i => (i.funcionario !== undefined ? { tipo: i.tipo, valor: i.valor, funcionario: i.funcionario.trim() } : { tipo: i.tipo, valor: i.valor })),
    recebedor: '',
    temAssinatura: false,
    temFoto: !!n.foto,
    falha: false,
    motivoFalha: '',
    zona: n.zona || '',
    canal: '',
    geo: null,
    localDivergente: false,
    entregadoPor: quem.email,
    entregadoPorNome: quem.nome || quem.email,
    status: 'pendente',
    criadoEm: agora,
    confirmadoEm: null,
  };
}

/** De volta à rota depois de não entregue (a "Nova tentativa" do Entregas): os mesmos documentos, a tentativa seguinte. */
export function dadosDaNovaTentativa(e: Entrega, motivo: string, quem: QuemEntrega, agora: string): Record<string, unknown> {
  return {
    clienteId: e.clienteId || '',
    clienteNome: e.clienteNome,
    competencia: e.competencia,
    itens: e.itens,
    zona: e.zona,
    observacao: '',
    status: 'pendente',
    tentativa: e.tentativa + 1,
    motivoTentativaAnterior: motivo,
    entregadoPor: quem.email,
    entregadoPorNome: quem.nome || quem.email,
    criadoEm: agora,
  };
}

/** Como a parada terminou: entregue (com assinatura ou foto), entregue sem a assinatura (a foto vale), ou não entregue. */
export type ComoFoi = 'entregue' | 'sem_assinatura' | 'falha';

export interface Confirmacao {
  como: ComoFoi;
  recebedor: string;
  motivo: string;
  assinatura: string | null;
  foto: string | null;
}

/** Só honorário em dinheiro, ou só notas: não pede comprovante (a regra do Entregas). */
export function dispensaComprovante(itens: readonly ItemDaEntrega[]): boolean {
  const tipos = itens.map(i => i.tipo);
  return tipos.length > 0 && (tipos.every(t => t === 'Honorário') || tipos.every(t => t === 'Notas'));
}

/** O que falta para confirmar (as exigências da janela da parada do Entregas). */
export function faltasNaConfirmacao(c: Confirmacao, itens: readonly ItemDaEntrega[]): string[] {
  if (c.como === 'falha') return [...(c.motivo.trim() ? [] : ['o que aconteceu']), ...(c.foto ? [] : ['a foto'])];
  if (c.como === 'sem_assinatura') return c.foto ? [] : ['a foto (ela vale como comprovante)'];
  if (dispensaComprovante(itens)) return [];
  return c.assinatura || c.foto ? [] : ['a assinatura ou a foto'];
}

/** A atualização da entrega ao confirmar (campo a campo como o Entregas grava; as regras exigem entregadoPor = quem confirma). */
export function dadosDaConfirmacao(e: Pick<Entrega, 'temFoto'>, c: Confirmacao, quem: QuemEntrega, agora: string): Record<string, unknown> {
  const falha = c.como === 'falha';
  const semAssinatura = c.como === 'sem_assinatura';
  return {
    recebedor: falha ? '' : c.recebedor.trim(),
    geo: null,
    temAssinatura: !falha && !semAssinatura && !!c.assinatura,
    temFoto: !!c.foto || e.temFoto,
    semComprovante: false,
    semAssinatura,
    motivoSemAssinatura: semAssinatura ? c.motivo.trim() : '',
    localDivergente: false,
    distanciaDoClienteKm: null,
    falha,
    motivoFalha: falha ? c.motivo.trim() : '',
    entregadoPor: quem.email,
    entregadoPorNome: quem.nome || quem.email,
    status: falha ? 'falha' : 'confirmada',
    confirmadoEm: agora,
  };
}

/** O comprovante que vai junto (só o que existe: gravar null apagaria a guia que já estava lá). */
export function comprovanteDaConfirmacao(c: Confirmacao): { assinatura?: string; foto?: string } | null {
  const r: { assinatura?: string; foto?: string } = {};
  if (c.como === 'entregue' && c.assinatura) r.assinatura = c.assinatura;
  if (c.foto) r.foto = c.foto;
  return Object.keys(r).length ? r : null;
}

/** Tirar da rota / excluir: o admin sempre; os outros, só a parada que eles puseram e que ainda não foi entregue. */
export function podeExcluir(e: Pick<Entrega, 'status' | 'entregadoPor'>, p: { admin: boolean; email: string }): boolean {
  if (p.admin) return true;
  return (e.status === 'pendente' || e.status === 'link') && !!e.entregadoPor && !!p.email && e.entregadoPor === p.email;
}

// ---------------------------------------------------------------------------------------------------------------------
// o vencimento automático (dia 20 do mês seguinte à competência; FGTS, DARF e eSocial antecipam o fim de semana, o DAS adia)
// ---------------------------------------------------------------------------------------------------------------------
const VENCIMENTO_AUTOMATICO: Record<string, 'antecipa' | 'posterga'> = { DAS: 'posterga', FGTS: 'antecipa', DARF: 'antecipa', eSocial: 'antecipa' };

function vencimentoDoTipo(competencia: string, tipo: string): string | null {
  const ajuste = VENCIMENTO_AUTOMATICO[tipo];
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!ajuste || !m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]), 20));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + (ajuste === 'antecipa' ? -1 : 1));
  return d.toISOString().slice(0, 10);
}

/**
 * O vencimento que o Entregas preenche sozinho: quando os documentos com regra (DAS, FGTS, DARF, eSocial) dão todos a mesma
 * data. Só o fim de semana conta (os feriados ficam por conta de quem confere). null = não dá para sugerir.
 */
export function vencimentoAutomatico(competencia: string, itens: readonly Pick<ItemDaEntrega, 'tipo'>[]): string | null {
  const datas = new Set(itens.map(i => vencimentoDoTipo(competencia, i.tipo)).filter((x): x is string => !!x));
  return datas.size === 1 ? [...datas][0] : null;
}

/** O texto do comprovante para mandar ao cliente (o "Enviar comprovante" do Entregas). */
export function textoDoComprovante(e: Entrega, rotuloDaCompetencia: (c: string) => string, reais: (n: number) => string, dataHora: (iso: string) => string): string {
  const itens = e.itens.map(i => '• ' + i.tipo + (i.valor != null ? ' — ' + reais(i.valor) : '')).join('\n');
  const total = totalDosItens(e.itens);
  return 'Comprovante de entrega — ' + e.clienteNome + '\n' + rotuloDaCompetencia(e.competencia) + '\n\n' + itens
    + (total > 0 ? '\n\nTotal: ' + reais(total) : '')
    + '\nRecebido por: ' + (e.recebedor || 'não informado')
    + '\nEntregue por: ' + (e.entregadoPorNome || e.entregadoPor || 'não informado')
    + '\nData: ' + dataHora(quandoFoi(e));
}
