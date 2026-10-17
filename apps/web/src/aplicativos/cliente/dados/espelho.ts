// A leitura do espelho da Área do Cliente (17/10/2026): o que o robô grava em areasCliente/{token}/... (robo/area-cliente.js;
// as guias de DAS/DAE vêm do robo/envios-do-nads.js) vira os tipos do core, campo por campo, e o que vier torto é
// descartado em vez de quebrar a tela. Também os pedidos que o cliente manda (as caixas areaClienteChamados e
// areaClienteEnvios, com as chaves exatas das regras do banco) e o que ele mandou e ainda não voltou pelo espelho (o robô
// do PC processa a caixa). Funções puras, sem Firebase: o repositório (areaCliente.firestore.ts) só lê e grava.
import { areaCliente as ac } from '@nads/core';
import { AREA_VAZIA, SECOES_DO_BANCO, type EstadoDaArea } from './areaCliente';

/** O token do link: 40 letras hexadecimais minúsculas (o mesmo que as regras do banco e o robô aceitam). */
export const ehTokenDoLink = (t: string) => /^[0-9a-f]{40}$/.test(t);

type Solto = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === 'string' ? v : '');
const objeto = (v: unknown): Solto | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Solto) : null);
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** O instante do banco como ISO: o texto que o robô grava, ou um Timestamp do Firestore. */
export function instante(v: unknown): string {
  if (typeof v === 'string') return v;
  const o = objeto(v);
  if (o && typeof o.toDate === 'function') return (o.toDate as () => Date)().toISOString();
  return '';
}

/** O robô grava o CNPJ (ou o CPF) só com os dígitos: a tela mostra com a máscara, como no exemplo. */
export function documentoFormatado(doc: string): string {
  const d = doc.replace(/\D/g, '');
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc.trim();
}

// ---------------------------------- o espelho (o que o robô grava) ----------------------------------

/** resumo/atual: { empresas: [{ codigo, nome, cnpj }], escritorio: { telefone?, email?, whatsapp? }, atualizadoEm }. */
export function lerResumo(x: unknown): ac.ResumoDoCliente | null {
  const r = objeto(x);
  if (!r) return null;
  const empresas = lista(r.empresas).map(objeto).filter((e): e is Solto => !!e && !!texto(e.nome).trim())
    .map(e => ({ codigo: typeof e.codigo === 'number' ? e.codigo : Number(e.codigo) || 0, nome: texto(e.nome).trim(), cnpj: documentoFormatado(texto(e.cnpj)) }));
  const esc = objeto(r.escritorio) ?? {};
  const escritorio: ac.ResumoDoCliente['escritorio'] = {};
  for (const k of ['telefone', 'email', 'whatsapp'] as const) if (texto(esc[k]).trim()) escritorio[k] = texto(esc[k]).trim();
  return { empresas, escritorio, atualizadoEm: instante(r.atualizadoEm) };
}

const TIPOS_DE_GUIA = new Set<string>(['FGTS', 'DAS', 'DAE', 'outra']);
const SITUACOES_DA_GUIA = new Set<string>(['a vencer', 'vence hoje', 'vencida']);

/** guias/{id}: { id, tipo, competencia, vencimento 'dd/mm/aaaa', valor, numero?, situacao, temPdf }. O id é o do documento. */
export function lerGuia(id: string, x: unknown): ac.GuiaDoCliente | null {
  const g = objeto(x);
  if (!g) return null;
  const competencia = texto(g.competencia);
  const vencimento = texto(g.vencimento);
  const valor = g.valor;
  if (!COMPETENCIA.test(competencia) || !ac.dataDoVencimento(vencimento) || typeof valor !== 'number' || !Number.isFinite(valor)) return null;
  const numero = texto(g.numero).trim();
  const situacao = texto(g.situacao);
  return {
    id,
    tipo: (TIPOS_DE_GUIA.has(texto(g.tipo)) ? g.tipo : 'outra') as ac.TipoDeGuia,
    competencia, vencimento, valor,
    ...(numero ? { numero } : {}),
    // quem mostra recalcula pela data de hoje (guiasDeHoje); aqui só não deixa passar um valor estranho
    situacao: (SITUACOES_DA_GUIA.has(situacao) ? situacao : 'a vencer') as ac.SituacaoDaGuia,
    temPdf: g.temPdf === true,
  };
}

const SITUACOES_DO_ITEM = new Set<string>(['feito', 'a fazer', 'nao se aplica']);

/** agenda/{AAAA-MM}: { mes, itens: [{ id, nome, vence 'aaaa-mm-dd', situacao, feitoEm? }], atualizadoEm }. */
export function lerAgenda(id: string, x: unknown): ac.AgendaDoMes | null {
  const a = objeto(x);
  if (!a) return null;
  const mes = COMPETENCIA.test(texto(a.mes)) ? texto(a.mes) : id;
  if (!COMPETENCIA.test(mes)) return null;
  const itens: ac.ItemDaAgenda[] = [];
  for (const i of lista(a.itens).map(objeto)) {
    if (!i || !texto(i.id) || !texto(i.nome) || !DIA.test(texto(i.vence)) || !SITUACOES_DO_ITEM.has(texto(i.situacao))) continue;
    const feitoEm = instante(i.feitoEm);
    itens.push({ id: texto(i.id), nome: texto(i.nome), vence: texto(i.vence), situacao: texto(i.situacao) as ac.SituacaoDoItem, ...(feitoEm ? { feitoEm } : {}) });
  }
  return { mes, itens };
}

/** envios/{id}: o recibo { id, nome, tipo, tamanho, recebidoEm }. */
export function lerRecibo(id: string, x: unknown): ac.ReciboDeEnvio | null {
  const e = objeto(x);
  if (!e || !texto(e.nome)) return null;
  const tamanho = typeof e.tamanho === 'number' && Number.isFinite(e.tamanho) ? e.tamanho : 0;
  return ac.reciboDoEnvio({ id, nome: texto(e.nome), tipo: texto(e.tipo), tamanho, recebidoEm: instante(e.recebidoEm) });
}

/** chamados/{id}: { id, tipo, titulo, situacao, mensagens: [{ de, autor, texto, em }] } (o autor do escritório já vem "Escritório"). */
export function lerChamado(id: string, x: unknown): ac.ChamadoDoCliente | null {
  const c = objeto(x);
  if (!c) return null;
  const mensagens = lista(c.mensagens).map(objeto).filter((m): m is Solto => !!m && !!texto(m.texto))
    .map(m => ({ de: texto(m.de), texto: texto(m.texto), em: instante(m.em) }));
  // a mesma lista branca do robô (chamadoDoCliente): tipo e situação desconhecidos viram "outro" e "aberto"
  return ac.chamadoDoCliente({ id, tipo: texto(c.tipo), titulo: texto(c.titulo) || 'Chamado', situacao: texto(c.situacao), mensagens });
}

/** a última mensagem (ou a primeira, se não tem hora): a ordem do histórico, o mais recente em cima */
const ultimaHora = (c: ac.ChamadoDoCliente) => c.mensagens.reduce((m, x) => (x.em > m ? x.em : m), '');
export const maisRecentePrimeiro = (a: ac.ChamadoDoCliente, b: ac.ChamadoDoCliente) => ultimaHora(b).localeCompare(ultimaHora(a));

// ---------------------------------- o que o cliente mandou e ainda não voltou ----------------------------------

/** Um chamado aberto agora (o id é o do pedido na caixa: o robô usa o mesmo id no chamado). */
export interface ChamadoPendente { id: string; tipo: ac.TipoDeChamado; titulo: string; texto: string; em: string }
/** Uma resposta mandada agora num chamado que já existe. */
export interface RespostaPendente { chamadoId: string; texto: string; em: string }

/** dá uma folga de 10 min no relógio do computador do cliente (a hora da mensagem no espelho é a do robô) */
const FOLGA_MS = 10 * 60 * 1000;

/** A resposta já está no espelho? (uma mensagem do cliente com o mesmo texto, de depois que ela saiu) */
export function respostaVoltou(r: RespostaPendente, chamados: ac.ChamadoDoCliente[]): boolean {
  const c = chamados.find(x => x.id === r.chamadoId);
  const desde = new Date(r.em).getTime() - FOLGA_MS;
  return !!c && c.mensagens.some(m => m.de === 'cliente' && m.texto.trim() === r.texto.trim() && !(new Date(m.em).getTime() < desde));
}

/**
 * Os chamados do espelho com o que o cliente mandou e o robô ainda não processou: o chamado novo aparece "aberto" com a
 * mensagem dele, e a resposta entra no fim da conversa (o chamado volta para "aberto", como o robô faz). Some daqui
 * quando o espelho traz o de verdade.
 */
export function comPendentes(chamados: ac.ChamadoDoCliente[], novos: ChamadoPendente[], respostas: RespostaPendente[]): ac.ChamadoDoCliente[] {
  const ids = new Set(chamados.map(c => c.id));
  const abertos: ac.ChamadoDoCliente[] = novos.filter(p => !ids.has(p.id)).map(p => ({
    id: p.id, tipo: p.tipo, titulo: p.titulo, situacao: 'aberto',
    mensagens: [{ de: 'cliente', autor: 'Você', texto: p.texto, em: p.em }],
  }));
  const comRespostas = chamados.map(c => {
    const minhas = respostas.filter(r => r.chamadoId === c.id && !respostaVoltou(r, chamados));
    if (!minhas.length) return c;
    return {
      ...c, situacao: c.situacao === 'respondido' ? 'aberto' as const : c.situacao,
      mensagens: [...c.mensagens, ...minhas.map(r => ({ de: 'cliente' as const, autor: 'Você', texto: r.texto, em: r.em }))],
    };
  });
  return [...abertos, ...comRespostas].sort(maisRecentePrimeiro);
}

// ---------------------------------- o estado da tela ----------------------------------

export interface PartesDoEspelho {
  resumo: ac.ResumoDoCliente | null;
  /** o nome do link (o documento areasCliente/{token}): só para o topo enquanto o robô não gravou o resumo */
  nomeDoLink: string;
  guias: ac.GuiaDoCliente[];
  agenda: ac.AgendaDoMes[];
  envios: ac.ReciboDeEnvio[];
  chamados: ac.ChamadoDoCliente[];
}

/** O que a tela recebe de um link do banco: o que o espelho tem; as seções sem fonte ficam vazias e escondidas. */
export function estadoDoEspelho(p: PartesDoEspelho, novos: ChamadoPendente[] = [], respostas: RespostaPendente[] = []): EstadoDaArea {
  const resumo = p.resumo ?? (p.nomeDoLink ? { empresas: [{ codigo: 0, nome: p.nomeDoLink, cnpj: '' }], escritorio: {}, atualizadoEm: '' } : null);
  return {
    ...AREA_VAZIA, carregado: true, valido: true, exemplos: false, secoes: SECOES_DO_BANCO,
    resumo,
    guias: p.guias,
    agenda: [...p.agenda].sort((a, b) => a.mes.localeCompare(b.mes)),
    envios: [...p.envios].sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm)),
    chamados: comPendentes(p.chamados, novos, respostas),
  };
}

// ---------------------------------- as caixas de entrada (o que o cliente cria) ----------------------------------

/** areaClienteChamados sem o criadoEm (o repositório põe a hora do servidor): as chaves que a regra aceita. */
export interface PedidoDeChamado { token: string; tipo: ac.TipoDeChamado; texto: string; titulo?: string; chamadoId?: string }

/**
 * O pedido de chamado: o novo leva o título (a primeira linha, até 60 letras; a regra aceita até 120); a resposta leva o
 * id do chamado e o tipo dele (a regra exige o tipo). Devolve o erro em português, ou o pedido.
 */
export function pedidoDeChamado(token: string, dados: { tipo: string; texto: string; chamadoId?: string }): { erro: string } | { pedido: PedidoDeChamado } {
  if (!ehTokenDoLink(token)) return { erro: 'Este link não vale mais. Peça um novo ao escritório.' };
  const texto = dados.texto.trim();
  const erro = ac.erroDoNovoChamado(dados.tipo, texto);
  if (erro) return { erro };
  const tipo = dados.tipo as ac.TipoDeChamado;
  if (dados.chamadoId != null) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(dados.chamadoId)) return { erro: 'Não achamos este chamado.' };
    return { pedido: { token, chamadoId: dados.chamadoId, tipo, texto } };
  }
  return { pedido: { token, tipo, titulo: ac.tituloDoChamado(tipo, texto).slice(0, 120), texto } };
}

/** areaClienteEnvios sem o criadoEm: as chaves que a regra aceita. */
export interface PedidoDeEnvio { token: string; nome: string; tipo: ac.TipoDeEnvio; mime: string; tamanho: number; base64: string }

/** 700 KB em base64 dão ~956 mil letras: o teto da regra é 960 mil */
const MAIOR_BASE64 = 960_000;
const TIPOS_DE_ENVIO = new Set<string>(ac.TIPOS_DE_ENVIO.map(t => t.valor));

/** O pedido de envio de um arquivo (o mime pela extensão, como a regra e o robô esperam). Devolve o erro, ou o pedido. */
export function pedidoDeEnvio(token: string, tipo: string, arquivo: { nome: string; tamanho: number }, base64: string): { erro: string } | { pedido: PedidoDeEnvio } {
  if (!ehTokenDoLink(token)) return { erro: 'Este link não vale mais. Peça um novo ao escritório.' };
  if (!TIPOS_DE_ENVIO.has(tipo)) return { erro: 'Escolha o que é o arquivo.' };
  const erro = ac.erroDoEnvio(arquivo);
  if (erro) return { erro };
  if (arquivo.nome.length > 200) return { erro: arquivo.nome.slice(0, 40) + '…: o nome do arquivo é grande demais. Troque por um nome mais curto.' };
  if (!Number.isInteger(arquivo.tamanho) || !base64 || base64.length > MAIOR_BASE64) return { erro: arquivo.nome + ': não deu para ler o arquivo.' };
  return { pedido: { token, nome: arquivo.nome, tipo: tipo as ac.TipoDeEnvio, mime: ac.mimeDoEnvio(arquivo.nome), tamanho: arquivo.tamanho, base64 } };
}

/** Os bytes do arquivo em base64 (em blocos, para não estourar a pilha com 700 KB). */
export function base64DosBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** O nome do PDF da guia que desce para o cliente (o mesmo do exemplo). */
export const nomeDoPdfDaGuia = (g: Pick<ac.GuiaDoCliente, 'tipo' | 'competencia'> | null) => (g ? `guia-${g.tipo.toLowerCase()}-${g.competencia}.pdf` : 'guia.pdf');
