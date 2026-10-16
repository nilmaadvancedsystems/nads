// A entrega de documentos aos clientes, trazida do Entregas para o nads (16/10/2026: "quero integrar no app … o entregas,
// só que preciso que fique tudo no visual igual"; e, no mesmo dia, depois de ver a primeira versão: "só copia o entregas e
// joga aqui no design n1"). As regras puras das abas Nova entrega, Rota e Painel e do detalhe do cliente, as MESMAS do
// entregas.html, sobre os MESMOS documentos do banco do Entregas (a página antiga continua funcionando junto):
//   entregas/{id}  { clienteId|null, clienteNome, avulso, banco|null, competencia 'AAAA-MM', vencimento 'AAAA-MM-DD'|'',
//                    codigoPagamento {tipo, codigo}|null, temGuia, itens [{tipo, valor|null, funcionario?}], recebedor,
//                    temAssinatura, temFoto, falha, motivoFalha, semAssinatura, motivoSemAssinatura, semComprovante,
//                    zona, canal ('' | 'link'), geo {lat, lng, accuracy}|null, localDivergente, distanciaDoClienteKm,
//                    entregadoPor (e-mail), entregadoPorNome, status 'pendente' | 'link' | 'confirmada' | 'falha',
//                    criadoEm, confirmadoEm|null, ordemRota?, tentativa?, motivoTentativaAnterior?, observacao? }
//   entregas/{id}/anexos/comprovante  { assinatura?: PNG em data URL, foto?: JPEG em data URL }
//   entregas/{id}/anexos/guia-<tipo>  { tipo, nome, driveId, tamanho, em, pdf? (Base64) }  (as guias da pasta do cliente)
//   clientes/{id}  o cadastro do Entregas (nome, código, documento, contato, endereço, zona, geo, grupoLocal, portalToken,
//                  diasEntrega, janela, honorário, etiquetas, contatos, papéis, ocorrências, receita…)
//   config/rotaPadrao  { zonas: {clienteId: zona}, ordem: {clienteId: n} } (a ordem fixa do escritório)
// O resto (a rota, as guias do PDF, o painel, o cliente e o link dele) fica nos arquivos vizinhos.

export type StatusDaEntrega = 'pendente' | 'link' | 'confirmada' | 'falha';
export type Zona = 'superior' | 'central' | 'inferior';

/** As regiões da rota (os rótulos do Entregas: ZONA_LABEL). */
export const ZONAS: readonly { valor: Zona; rotulo: string }[] = [
  { valor: 'superior', rotulo: 'Parte superior' },
  { valor: 'central', rotulo: 'Central' },
  { valor: 'inferior', rotulo: 'Parte inferior' },
];
export const rotuloDaZona = (z: string) => ZONAS.find(x => x.valor === z)?.rotulo || '';

/** Os documentos que se entregam (DOC_TIPOS do Entregas; os sem valor não pedem o R$; a multa pede o funcionário). */
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
export const tipoPelaChave = (chave: string) => TIPOS_DE_DOCUMENTO.find(t => t.chave === chave) || null;
export const tipoPeloRotulo = (rotulo: string) => TIPOS_DE_DOCUMENTO.find(t => t.rotulo === rotulo) || null;

/** Os motivos de "não entregue" num toque (MOTIVOS_DE_FALHA_ do Entregas). */
export const MOTIVOS_DE_FALHA: readonly string[] = ['Estabelecimento fechado', 'Cliente ausente', 'Ninguém atendeu', 'Recusou receber', 'Endereço errado', 'Mudou de endereço', 'Pediu pra voltar outro dia'];

/** O motivo do começo do texto trocado pelo do toque, mantendo o que a pessoa escreveu depois. */
export function motivoComToque(atual: string, motivo: string): string {
  let resto = atual;
  for (const x of MOTIVOS_DE_FALHA) if (resto.startsWith(x)) resto = resto.slice(x.length).replace(/^[\s.,;:–-]+/, '');
  return motivo + (resto ? '. ' + resto : '');
}
/** O motivo padronizado de um texto livre (para a estatística); '' se vazio. */
export function motivoPadrao(texto: string): string {
  const t = String(texto || '');
  for (const m of MOTIVOS_DE_FALHA) if (t.startsWith(m)) return m;
  return t ? 'Outro motivo' : '';
}

export interface ItemDaEntrega { tipo: string; valor: number | null; funcionario?: string }
export interface Geo { lat: number; lng: number; accuracy?: number | null; precisao?: string; origem?: string; referencia?: string }
export interface CodigoPagamento { tipo: 'pix' | 'boleto'; codigo: string }

export interface Entrega {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  avulso: boolean;
  banco: string | null;
  competencia: string;
  vencimento: string;
  codigoPagamento: CodigoPagamento | null;
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
  semComprovante: boolean;
  motivoSemComprovante: string;
  recebidoPeloLink: boolean;
  canal: string;
  geo: Geo | null;
  localDivergente: boolean;
  distanciaDoClienteKm: number | null;
  entregadoPor: string;
  entregadoPorNome: string;
  status: StatusDaEntrega;
  criadoEm: string;
  confirmadoEm: string | null;
  ordemRota: number | null;
  tentativa: number;
  motivoTentativaAnterior: string;
  observacao: string;
  /** o comprovante foi mandado por e-mail ao cliente (comprovanteEmail.para) */
  comprovantePorEmail: boolean;
}

export interface ContatoDoCliente { nome: string; papel: string; telefone: string }
export interface PapelDoCliente { tipo: string; vence: string; observacao: string }
export interface OcorrenciaDoCliente { tipo: string; texto: string; por: string; em: string }
export interface MudancaNaReceita { texto: string; grave: boolean; em: string }
export interface ReceitaDoCliente {
  situacao: string; situacaoDesde: string; motivoSituacao: string; razaoSocial: string; mei: boolean; simples: boolean;
  cnae: string; cnaeDescricao: string; naturezaJuridica: string; porte: string; abertura: string; endereco: string;
  socios: string[]; conferidoEm: string; mudancas: MudancaNaReceita[];
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
  /** empresas no mesmo endereço: uma parada só (o id da empresa de referência) */
  grupoLocal: string;
  geo: Geo | null;
  endereco: string;
  bairro: string;
  cidade: string;
  cep: string;
  email: string;
  emails: string[];
  nomeFantasia: string;
  inscricaoEstadual: string;
  enquadramento: string;
  portalToken: string;
  /** os dias da semana em que recebe ('1' = segunda … '5' = sexta); vazio = qualquer dia */
  diasEntrega: string[];
  /** o horário em que atende ('08:00' a '17:00') */
  janela: { de: string; ate: string } | null;
  pontoReferencia: string;
  honorarioForma: string;
  honorarioDia: string;
  observacao: string;
  etiquetas: string[];
  contatos: ContatoDoCliente[];
  papeis: PapelDoCliente[];
  ocorrencias: OcorrenciaDoCliente[];
  receita: ReceitaDoCliente | null;
  criadoEm: string;
  documentosNaoAplicaveis: string[];
}

export interface RotaPadrao { zonas: Record<string, string>; ordem: Record<string, number> }
export const ROTA_PADRAO_VAZIA: RotaPadrao = { zonas: {}, ordem: {} };

const texto = (v: unknown) => (v == null ? '' : String(v));
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const STATUS: readonly StatusDaEntrega[] = ['pendente', 'link', 'confirmada', 'falha'];

/** O item como está no banco (as entregas antigas guardavam só o nome do documento). */
function itemDoBanco(i: unknown): ItemDaEntrega | null {
  if (typeof i === 'string') return i ? { tipo: i, valor: null } : null;
  if (!i || typeof i !== 'object') return null;
  const o = i as Record<string, unknown>;
  const tipo = texto(o.tipo);
  if (!tipo) return null;
  const valor = typeof o.valor === 'number' && Number.isFinite(o.valor) ? o.valor : null;
  return o.funcionario !== undefined ? { tipo, valor, funcionario: texto(o.funcionario) } : { tipo, valor };
}

export function geoDoBanco(v: unknown): Geo | null {
  const g = objeto(v);
  if (typeof g.lat !== 'number' || typeof g.lng !== 'number') return null;
  const r: Geo = { lat: g.lat, lng: g.lng };
  if (typeof g.accuracy === 'number') r.accuracy = g.accuracy;
  if (g.precisao) r.precisao = texto(g.precisao);
  if (g.origem) r.origem = texto(g.origem);
  if (g.referencia) r.referencia = texto(g.referencia);
  return r;
}

export function entregaDoDocumento(id: string, d: Record<string, unknown>): Entrega {
  const cp = objeto(d.codigoPagamento);
  return {
    id,
    clienteId: d.clienteId ? texto(d.clienteId) : null,
    clienteNome: texto(d.clienteNome),
    avulso: !!d.avulso,
    banco: d.banco ? texto(d.banco) : null,
    competencia: texto(d.competencia),
    vencimento: texto(d.vencimento),
    codigoPagamento: cp.codigo ? { tipo: cp.tipo === 'pix' ? 'pix' : 'boleto', codigo: texto(cp.codigo) } : null,
    itens: lista(d.itens).map(itemDoBanco).filter((x): x is ItemDaEntrega => !!x),
    zona: texto(d.zona),
    recebedor: texto(d.recebedor),
    temAssinatura: !!d.temAssinatura,
    temFoto: !!d.temFoto,
    temGuia: !!d.temGuia,
    falha: !!d.falha,
    motivoFalha: texto(d.motivoFalha),
    semAssinatura: !!d.semAssinatura,
    motivoSemAssinatura: texto(d.motivoSemAssinatura),
    semComprovante: !!d.semComprovante,
    motivoSemComprovante: texto(d.motivoSemComprovante),
    recebidoPeloLink: !!d.recebidoPeloLink,
    canal: texto(d.canal),
    geo: geoDoBanco(d.geo),
    localDivergente: !!d.localDivergente,
    distanciaDoClienteKm: typeof d.distanciaDoClienteKm === 'number' ? d.distanciaDoClienteKm : null,
    entregadoPor: texto(d.entregadoPor),
    entregadoPorNome: texto(d.entregadoPorNome),
    status: STATUS.includes(d.status as StatusDaEntrega) ? (d.status as StatusDaEntrega) : 'pendente',
    criadoEm: texto(d.criadoEm),
    confirmadoEm: d.confirmadoEm ? texto(d.confirmadoEm) : null,
    ordemRota: typeof d.ordemRota === 'number' ? d.ordemRota : null,
    tentativa: typeof d.tentativa === 'number' && d.tentativa > 1 ? d.tentativa : 1,
    motivoTentativaAnterior: texto(d.motivoTentativaAnterior),
    observacao: texto(d.observacao),
    comprovantePorEmail: !!objeto(d.comprovanteEmail).para,
  };
}

function receitaDoBanco(v: unknown): ReceitaDoCliente | null {
  const r = objeto(v);
  if (r.situacao === undefined) return null;
  return {
    situacao: texto(r.situacao), situacaoDesde: texto(r.situacaoDesde), motivoSituacao: texto(r.motivoSituacao), razaoSocial: texto(r.razaoSocial),
    mei: !!r.mei, simples: !!r.simples, cnae: texto(r.cnae), cnaeDescricao: texto(r.cnaeDescricao), naturezaJuridica: texto(r.naturezaJuridica),
    porte: texto(r.porte), abertura: texto(r.abertura), endereco: texto(r.endereco), socios: lista(r.socios).map(texto).filter(Boolean),
    conferidoEm: texto(r.conferidoEm),
    mudancas: lista(r.mudancas).map(objeto).filter(m => m.texto).map(m => ({ texto: texto(m.texto), grave: !!m.grave, em: texto(m.em) })),
  };
}

export function clienteDaRotaDoDocumento(id: string, d: Record<string, unknown>): ClienteDaRota {
  const j = objeto(d.janela);
  return {
    id, nome: texto(d.nome), codigoOrigem: texto(d.codigoOrigem), documento: texto(d.documento), telefone: texto(d.telefone),
    ativo: d.ativo !== false, entrega: d.entrega === true, zona: texto(d.zona), grupoLocal: texto(d.grupoLocal),
    geo: geoDoBanco(d.geo), endereco: texto(d.endereco), bairro: texto(d.bairro), cidade: texto(d.cidade), cep: texto(d.cep),
    email: texto(d.email), emails: lista(d.emails).map(texto).filter(Boolean), nomeFantasia: texto(d.nomeFantasia),
    inscricaoEstadual: texto(d.inscricaoEstadual), enquadramento: texto(d.enquadramento), portalToken: texto(d.portalToken),
    diasEntrega: lista(d.diasEntrega).map(texto), janela: j.de && j.ate ? { de: texto(j.de), ate: texto(j.ate) } : null,
    pontoReferencia: texto(d.pontoReferencia), honorarioForma: texto(d.honorarioForma), honorarioDia: texto(d.honorarioDia),
    observacao: texto(d.observacao), etiquetas: lista(d.etiquetas).map(texto).filter(Boolean),
    contatos: lista(d.contatos).map(objeto).filter(c => c.nome || c.telefone).map(c => ({ nome: texto(c.nome), papel: texto(c.papel), telefone: texto(c.telefone) })),
    papeis: lista(d.papeis).map(objeto).filter(p => p.tipo && p.vence).map(p => ({ tipo: texto(p.tipo), vence: texto(p.vence), observacao: texto(p.observacao) })),
    ocorrencias: lista(d.ocorrencias).map(objeto).map(o => ({ tipo: texto(o.tipo), texto: texto(o.texto), por: texto(o.por), em: texto(o.em) })),
    receita: receitaDoBanco(d.receita), criadoEm: texto(d.criadoEm),
    documentosNaoAplicaveis: lista(d.documentosNaoAplicaveis).map(texto),
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

// ---------------------------------------------------------------------------------------------------------------------
// formatos (os do Entregas)
// ---------------------------------------------------------------------------------------------------------------------
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** '2026-09' → 'setembro/2026' (fmtCompetencia do Entregas). */
export function rotuloDaCompetencia(comp: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(comp || '');
  return m && MESES[Number(m[2]) - 1] ? MESES[Number(m[2]) - 1] + '/' + m[1] : comp || '';
}
/** A competência de hoje ('AAAA-MM'). */
export function competenciaAtual(hoje = new Date()): string {
  return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
}
/** A competência anterior a esta. */
export function competenciaAnterior(comp: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(comp) || ['', '2026', '01'];
  const d = new Date(Number(m[1]), Number(m[2]) - 2, 1);
  return competenciaAtual(d);
}
/** As últimas n competências, a de agora primeiro. */
export function ultimasCompetencias(n: number, hoje = new Date()): string[] {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const r: string[] = [];
  for (let i = 0; i < n; i++) { r.push(competenciaAtual(d)); d.setMonth(d.getMonth() - 1); }
  return r;
}
/** '16/10/2026 14:30' (fmtDateTime do Entregas). */
export function dataHoraDaEntrega(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
/** 'AAAA-MM-DD' → 'dd/mm/aaaa' (só a parte da data, sem fuso). */
export const dataBr = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
/** A data de hoje no fuso daqui ('AAAA-MM-DD'). */
export function hojeIso(hoje = new Date()): string {
  return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
}
/** 'R$ 1.234,56' (fmtMoney do Entregas). */
export function dinheiro(n: number | null | undefined): string {
  if (n == null) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
/** '11.222.333/0001-81' ou '123.456.789-01' (fmtDocumento_). */
export function documentoFormatado(d: string): string {
  const n = String(d || '').replace(/\D/g, '');
  if (n.length === 14) return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (n.length === 11) return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return String(d || '');
}

// ---------------------------------------------------------------------------------------------------------------------
// clientes, busca e valores
// ---------------------------------------------------------------------------------------------------------------------
/** "123 - NOME DO CLIENTE" (o rótulo do Entregas; também é o clienteNome gravado na entrega). */
export const rotuloDoCliente = (c: Pick<ClienteDaRota, 'codigoOrigem' | 'nome'>) => (c.codigoOrigem ? c.codigoOrigem + ' - ' : '') + c.nome;

export const semAcento = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** A busca do Entregas: nome (sem acento), código, ou parte do CNPJ/CPF (3 dígitos ou mais, com ou sem pontuação). */
export function clienteCombina(c: Pick<ClienteDaRota, 'nome' | 'codigoOrigem' | 'documento'>, busca: string): boolean {
  const q = semAcento(busca.trim());
  if (!q) return true;
  const digitos = q.replace(/\D/g, '');
  return semAcento(c.nome).includes(q) || semAcento(c.codigoOrigem).includes(q)
    || (digitos.length >= 3 && c.documento.replace(/\D/g, '').includes(digitos));
}

/**
 * O valor digitado (parseValor do Entregas): quem decide se o separador é decimal é a POSIÇÃO — separador seguido de 1 ou 2
 * dígitos no fim é decimal, qualquer outro é milhar. "R$ 1.500" é mil e quinhentos (não 1,5). Arredonda no centavo.
 */
export function valorDigitado(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  let limpo = String(v).trim().replace(/[^\d,.-]/g, '');
  const negativo = limpo.charAt(0) === '-';
  limpo = limpo.replace(/-/g, '');
  if (!/\d/.test(limpo)) return null;
  const fim = limpo.match(/[.,](\d{1,2})$/);
  const numero = fim ? limpo.slice(0, -fim[0].length).replace(/[.,]/g, '') + '.' + fim[1] : limpo.replace(/[.,]/g, '');
  let n = parseFloat(numero);
  if (isNaN(n)) return null;
  n = Math.round(n * 100) / 100;
  return negativo ? -n : n;
}
/** O valor no campo para editar ('1234,5' → como o Entregas devolve ao repetir o mês: o ponto vira vírgula). */
export const valorParaCampo = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

export const totalDosItens = (itens: readonly ItemDaEntrega[]) => Math.round(itens.reduce((s, i) => s + (i.valor || 0), 0) * 100) / 100;
export const textoDosItens = (itens: readonly ItemDaEntrega[]) => itens.map(i => i.tipo).join(', ');
/** "DAS · R$ 10,00 · Fulano" (a ficha de cada documento nas janelas). */
export const fichaDoItem = (i: ItemDaEntrega) => i.tipo + (i.valor != null ? ' · ' + dinheiro(i.valor) : '') + (i.funcionario ? ' · ' + i.funcionario : '');

/** A data em que a entrega aconteceu (ou foi posta na rota). */
export const quandoFoi = (e: Pick<Entrega, 'confirmadoEm' | 'criadoEm'>) => e.confirmadoEm || e.criadoEm;

/** "Entregue", "Recebido pelo link", "Não entregue", "No link, aguardando", "Na rota" (o texto do protocolo). */
export function situacaoPorExtenso(e: Pick<Entrega, 'status' | 'recebidoPeloLink'>): string {
  if (e.status === 'confirmada') return e.recebidoPeloLink ? 'Recebido pelo link' : 'Entregue';
  if (e.status === 'falha') return 'Não entregue';
  return e.status === 'link' ? 'No link, aguardando' : 'Na rota';
}

/** Tirar da rota / excluir: o admin sempre; os outros, só a parada que eles puseram e que ainda não foi entregue (podeExcluir). */
export function podeExcluir(e: Pick<Entrega, 'status' | 'entregadoPor'>, p: { admin: boolean; email: string }): boolean {
  if (p.admin) return true;
  return (e.status === 'pendente' || e.status === 'link') && !!e.entregadoPor && !!p.email && e.entregadoPor === p.email;
}

/** As entregas da mais nova para a mais velha (pela data em que aconteceram). */
export const maisNovaPrimeiro = <T extends Pick<Entrega, 'confirmadoEm' | 'criadoEm'>>(l: readonly T[]): T[] =>
  [...l].sort((a, b) => new Date(quandoFoi(b)).getTime() - new Date(quandoFoi(a)).getTime());

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
 * Os clientes que contam para o Entregas (clientesDoEntregas_): os marcados como cliente de entrega, mais quem está na
 * rota agora; se ninguém foi marcado ainda, todos os ativos.
 */
export function clientesDeEntrega(clientes: readonly ClienteDaRota[], pendentes: readonly Pick<Entrega, 'clienteId'>[]): ClienteDaRota[] {
  const ativos = clientes.filter(c => c.ativo);
  if (!clientes.some(c => c.entrega)) return ativos;
  const naRota = new Set(pendentes.map(e => e.clienteId).filter(Boolean));
  return ativos.filter(c => c.entrega || naRota.has(c.id));
}

/** As linhas do Painel: sem busca, só os clientes do Entregas; com busca, qualquer cliente ativo. Depois os avulsos do mês. */
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
  // o avulso: confirmada é "entregue", o resto conta como "na rota" (como no Entregas); "sem entrega" não se aplica
  const avulsas = maisNovaPrimeiro(p.doMes.filter(e => e.avulso && (!qa || semAcento(e.clienteNome).includes(qa))))
    .map((e): LinhaDoPainel => ({ chave: 'avulsa-' + e.id, cliente: null, nome: e.clienteNome, situacao: e.status === 'confirmada' ? 'entregue' : 'rota', entregas: [e] }))
    .filter(l => p.filtro === 'todos' || p.filtro === 'com_entrega' || p.filtro === l.situacao);
  return [...linhas, ...avulsas];
}

/** O texto da linha do Painel (a data, "aguardando assinatura", o motivo, "+N"). */
export function subtituloDaLinhaDoPainel(l: LinhaDoPainel): string {
  const e = l.entregas[0];
  if (!e) return 'Sem entrega registrada nesta competência';
  if (!l.cliente) {
    return 'Avulso · ' + dataHoraDaEntrega(quandoFoi(e)) + (e.itens.length ? ' · ' + textoDosItens(e.itens) : '') + (e.status === 'confirmada' ? '' : ' · aguardando assinatura');
  }
  return dataHoraDaEntrega(quandoFoi(e))
    + (l.situacao === 'rota' ? (e.status === 'link' ? ' · no link, aguardando o cliente' : ' · aguardando assinatura') : '')
    + (l.situacao === 'falha' ? ' · ' + (e.motivoFalha || 'não entregue') : '')
    + (l.entregas.length > 1 ? ' · +' + (l.entregas.length - 1) + ' entrega(s) nesta competência' : '');
}

/** Quantos dos clientes do Entregas já receberam no mês (o anel do Painel: a entrega mais nova está confirmada). */
export function numerosDoMes(clientesDoMes: readonly ClienteDaRota[], doMes: readonly Entrega[]) {
  const porCliente = new Map<string, Entrega[]>();
  for (const e of doMes) if (e.clienteId) porCliente.set(e.clienteId, [...(porCliente.get(e.clienteId) || []), e]);
  const conta = { total: clientesDoMes.length, entregue: 0, rota: 0, falha: 0, sem_entrega: 0 };
  for (const c of clientesDoMes) conta[situacaoNoMes(porCliente.get(c.id) || [])]++;
  return { ...conta, porcento: conta.total ? Math.round((conta.entregue / conta.total) * 100) : 0 };
}
