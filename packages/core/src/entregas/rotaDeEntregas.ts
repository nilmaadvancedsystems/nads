// A Rota do Entregas no nads (16/10/2026, a cópia fiel: "só copia o entregas e joga aqui no design n1"): a ordem das
// paradas (a que alguém arrastou, a ordem fixa do escritório, a proximidade), a parada (o mesmo cliente com várias guias, e
// as empresas aglutinadas, são uma só), o aviso que faz desviar a viagem (fora do horário, dia errado, 2ª tentativa), a
// previsão no ritmo medido, o lugar da confirmação (aprender o ponto do cliente ou acusar que foi longe), os vencimentos da
// semana, as obrigações do mês, a qualidade da base (sem região, endereço impreciso), a ordem fixa, os protocolos do
// período, o fechamento do dia e a fila pública (rotaLinks). Tudo puro, como as funções do entregas.html.
import {
  clientesDeEntrega, quandoFoi, textoDosItens, type ClienteDaRota, type Entrega, type Geo, type RotaPadrao, ROTA_PADRAO_VAZIA,
} from './documentos';
import { ajustarDiaUtil, textoNormalizado } from './guiasDoPdf';

// ---------------------------------------------------------------------------------------------------------------------
// a parada e a ordem
// ---------------------------------------------------------------------------------------------------------------------
/** A parada: empresas no mesmo endereço (grupoLocal) e as várias guias do mesmo cliente contam como uma só. */
export function chaveDaParada(e: Pick<Entrega, 'clienteId' | 'clienteNome'>, clientes: ReadonlyMap<string, ClienteDaRota>): string {
  const c = e.clienteId ? clientes.get(e.clienteId) : undefined;
  return c?.grupoLocal || e.clienteId || e.clienteNome || '?';
}

const ORDEM_DAS_ZONAS: Record<string, number> = { superior: 0, central: 1, inferior: 2 };

function posicaoNaRotaFixa(e: Pick<Entrega, 'clienteId' | 'zona'>, fixa: RotaPadrao): number | null {
  if (!e.clienteId) return null;
  const pos = fixa.ordem[e.clienteId];
  if (typeof pos !== 'number') return null;
  const zona = fixa.zonas[e.clienteId] || e.zona || 'central';
  return (ORDEM_DAS_ZONAS[zona] ?? 1) * 1000 + pos;
}
const tempo = (s: string) => new Date(s).getTime() || 0;

/**
 * A ordem da rota, do mais forte para o mais fraco (ordenarPendentes_ do Entregas): 1. o que alguém arrastou (ordemRota);
 * 2. a ordem fixa do escritório (a região e a posição dentro dela); 3. quem entrou primeiro.
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
    return tempo(a.criadoEm) - tempo(b.criadoEm);
  });
}

/** O ponto confiável do cliente (o centro da cidade não localiza ninguém). */
export function pontoConfiavel(c: Pick<ClienteDaRota, 'geo'> | null | undefined): Geo | null {
  const g = c?.geo;
  return g && typeof g.lat === 'number' && g.precisao !== 'cidade' ? g : null;
}

/**
 * A proximidade automática (encaixarPorProximidade_): quem não foi arrastado nem está na ordem fixa entra logo depois da
 * parada mais perto dela, na mesma região. Só com ponto confiável; sem gravar nada (é só a ordem de mostrar).
 */
export function encaixarPorProximidade<T extends Pick<Entrega, 'ordemRota' | 'clienteId' | 'zona'>>(ordenada: readonly T[], fixa: RotaPadrao, clientes: ReadonlyMap<string, ClienteDaRota>): T[] {
  const geoDe = (e: T) => pontoConfiavel(e.clienteId ? clientes.get(e.clienteId) : null);
  const zonaDe = (e: T) => e.zona || (e.clienteId ? clientes.get(e.clienteId)?.zona || '' : '');
  const base: T[] = [];
  const soltos: T[] = [];
  for (const e of ordenada) (typeof e.ordemRota === 'number' || posicaoNaRotaFixa(e, fixa) !== null ? base : soltos).push(e);
  if (!soltos.length || !base.length) return [...ordenada];
  const semLugar: T[] = [];
  for (const e of soltos) {
    const g = geoDe(e);
    if (!g) { semLugar.push(e); continue; }
    const z = zonaDe(e);
    let melhor = -1, dist = Infinity;
    base.forEach((b, i) => {
      const gb = geoDe(b);
      if (!gb || (z && zonaDe(b) && zonaDe(b) !== z)) return;
      const d = distanciaKm(g, gb);
      if (d < dist) { dist = d; melhor = i; }
    });
    if (melhor === -1) semLugar.push(e); else base.splice(melhor + 1, 0, e);
  }
  return [...base, ...semLugar];
}

/** A ordem da rota na tela: a ordem e depois o encaixe por proximidade. */
export function ordenarPendentes<T extends Pick<Entrega, 'ordemRota' | 'clienteId' | 'zona' | 'criadoEm'>>(lista: readonly T[], fixa: RotaPadrao, clientes: ReadonlyMap<string, ClienteDaRota>): T[] {
  return encaixarPorProximidade(ordenarParadas(lista, fixa), fixa, clientes);
}

/** A ordem que vale é a da ROTA INTEIRA (ordemCompletaDaRota_): ordemRota, depois quem entrou primeiro (os ids). */
export function ordemCompletaDaRota(pendentes: readonly Pick<Entrega, 'id' | 'ordemRota' | 'criadoEm'>[]): string[] {
  return [...pendentes].sort((a, b) => {
    const ao = a.ordemRota, bo = b.ordemRota;
    if (ao !== null && bo !== null && ao !== bo) return ao - bo;
    if (ao !== null && bo === null) return -1;
    if (ao === null && bo !== null) return 1;
    return tempo(a.criadoEm) - tempo(b.criadoEm);
  }).map(e => e.id);
}
/**
 * A nova ordem das linhas visíveis encaixada nas posições que elas já ocupavam na rota completa, sem mexer em quem está
 * escondido pelo filtro (salvarOrdemVisivel_): o resultado vira o ordemRota de cada uma (a posição na lista).
 */
export function ordemComAsVisiveis(completa: readonly string[], visiveis: readonly string[]): string[] {
  const visivel = new Set(visiveis);
  const fila = [...visiveis];
  const finais = completa.map(id => (visivel.has(id) ? (fila.shift() as string) : id));
  return [...finais, ...fila];
}
/** Mover uma parada uma posição (Alt+↑/↓): a nova ordem dos ids. */
export function moverNaRota(ids: readonly string[], id: string, passo: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= ids.length) return [...ids];
  const nova = [...ids];
  nova.splice(i, 1);
  nova.splice(j, 0, id);
  return nova;
}
/** Arrastar: tira o id e põe na posição `para` (0 = primeiro). */
export function moverPara(ids: readonly string[], id: string, para: number): string[] {
  const sem = ids.filter(x => x !== id);
  const p = Math.max(0, Math.min(sem.length, para));
  return [...sem.slice(0, p), id, ...sem.slice(p)];
}

/** As paradas: as entregas da rota agrupadas pela chave (na ordem em que aparecem). */
export function paradasDaRota<T extends Pick<Entrega, 'clienteId' | 'clienteNome'>>(lista: readonly T[], clientes: ReadonlyMap<string, ClienteDaRota>): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const e of lista) { const k = chaveDaParada(e, clientes); m.set(k, [...(m.get(k) || []), e]); }
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------
// o aviso da parada (o mais caro primeiro: porta fechada agora > dia errado > já foi e não deu certo)
// ---------------------------------------------------------------------------------------------------------------------
const DIAS_DA_SEMANA: Record<string, string> = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex' };
export const textoDaJanela = (c: Pick<ClienteDaRota, 'janela'> | null | undefined) => (c?.janela ? 'atende ' + c.janela.de + '–' + c.janela.ate : '');
export function foraDaJanela(c: Pick<ClienteDaRota, 'janela'> | null | undefined, agora = new Date()): boolean {
  const j = c?.janela;
  if (!j) return false;
  const hhmm = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
  return hhmm < j.de || hhmm > j.ate;
}
export function recebeHoje(c: Pick<ClienteDaRota, 'diasEntrega'> | null | undefined, hoje = new Date()): boolean {
  const dias = c?.diasEntrega || [];
  return !dias.length || dias.includes(String(hoje.getDay()));
}
export const textoDiasDeEntrega = (c: Pick<ClienteDaRota, 'diasEntrega'> | null | undefined) => (c?.diasEntrega || []).map(d => DIAS_DA_SEMANA[d] || d).join(', ');

export function avisoDaParada(e: Pick<Entrega, 'tentativa' | 'motivoTentativaAnterior'>, c?: Pick<ClienteDaRota, 'janela' | 'diasEntrega'> | null, agora = new Date()): string {
  if (c && foraDaJanela(c, agora)) return textoDaJanela(c);
  if (c && !recebeHoje(c, agora)) return 'Recebe ' + textoDiasDeEntrega(c);
  if (e.tentativa > 1) return e.tentativa + 'ª tentativa' + (e.motivoTentativaAnterior ? ' — antes: ' + e.motivoTentativaAnterior : '');
  return '';
}

// ---------------------------------------------------------------------------------------------------------------------
// o lugar
// ---------------------------------------------------------------------------------------------------------------------
export function distanciaKm(a: Pick<Geo, 'lat' | 'lng'>, b: Pick<Geo, 'lat' | 'lng'>): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

const RAIO_CONFIRMACAO_KM = 0.3;
const ACCURACY_INUTIL_KM = 1.0;
export interface AvaliacaoDoLocal { aprender: boolean; divergente: boolean; distancia: number | null }
/**
 * Onde a confirmação aconteceu (avaliarLocalDaEntrega_): sem ponto bom ainda, aprende; perto do ponto (o raio cresce com a
 * imprecisão do GPS), aprende; longe, não mexe no cliente e marca "fora do local". GPS ruim (mais de 1 km de erro): nada.
 */
export function avaliarLocalDaEntrega(cliente: Pick<ClienteDaRota, 'geo'> | null | undefined, geo: Geo | null | undefined): AvaliacaoDoLocal {
  const vazio = { aprender: false, divergente: false, distancia: null };
  if (!cliente || !geo || typeof geo.lat !== 'number') return vazio;
  const accKm = typeof geo.accuracy === 'number' ? geo.accuracy / 1000 : 0;
  if (accKm > ACCURACY_INUTIL_KM) return vazio;
  const raio = Math.min(ACCURACY_INUTIL_KM, Math.max(RAIO_CONFIRMACAO_KM, accKm * 1.5));
  const atual = pontoConfiavel(cliente);
  if (!atual) return { aprender: true, divergente: false, distancia: null };
  const d = distanciaKm(atual, geo);
  return d <= raio ? { aprender: true, divergente: false, distancia: d } : { aprender: false, divergente: true, distancia: d };
}
/** O ponto que o cliente aprende com a confirmação feita na porta dele. */
export const geoAprendido = (g: Geo): Geo => ({ lat: g.lat, lng: g.lng, origem: 'entrega', precisao: 'rua', accuracy: g.accuracy ?? null });
/** O aviso de que a pessoa estava longe de onde o cliente está cadastrado (o cadastro NÃO muda). */
export const textoDoLocalDivergente = (a: AvaliacaoDoLocal, nome: string) =>
  'Você estava a ' + Math.round((a.distancia || 0) * 1000) + ' m de onde ' + (nome || 'o cliente') + ' está cadastrado. A entrega foi registrada e o local do cliente NÃO foi alterado. '
  + 'Se o cadastro é que está errado, use "Corrigir localização" na ficha dele.';

// ---------------------------------------------------------------------------------------------------------------------
// o ritmo e a previsão
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Quanto tempo costuma levar cada parada (minutosPorParada_): o intervalo entre confirmações seguidas da mesma pessoa no
 * mesmo dia, entre 1 e 90 minutos, pela mediana. Menos de 5 amostras: não estima.
 */
export function minutosPorParada(entregas: readonly Pick<Entrega, 'id' | 'status' | 'confirmadoEm' | 'entregadoPor'>[]): { minutos: number; amostras: number } | null {
  const porPessoaDia = new Map<string, number[]>();
  const vista = new Set<string>();
  for (const e of entregas) {
    if (vista.has(e.id)) continue;
    vista.add(e.id);
    if (e.status !== 'confirmada' || !e.confirmadoEm) continue;
    const t = new Date(e.confirmadoEm);
    if (isNaN(t.getTime())) continue;
    const k = (e.entregadoPor || '?') + '|' + t.toDateString();
    porPessoaDia.set(k, [...(porPessoaDia.get(k) || []), t.getTime()]);
  }
  const intervalos: number[] = [];
  for (const tempos of porPessoaDia.values()) {
    tempos.sort((a, b) => a - b);
    for (let i = 1; i < tempos.length; i++) {
      const min = (tempos[i] - tempos[i - 1]) / 60000;
      if (min >= 1 && min <= 90) intervalos.push(min);
    }
  }
  if (intervalos.length < 5) return null;
  intervalos.sort((a, b) => a - b);
  const meio = Math.floor(intervalos.length / 2);
  const mediana = intervalos.length % 2 ? intervalos[meio] : (intervalos[meio - 1] + intervalos[meio]) / 2;
  return { minutos: Math.round(mediana), amostras: intervalos.length };
}
export function duracaoTexto(minutos: number): string {
  const h = Math.floor(minutos / 60), m = Math.round(minutos % 60);
  if (!h) return m + ' min';
  return h + 'h' + (m ? String(m).padStart(2, '0') : '');
}
/** "· ~1h40 · até 16:20" (a previsão ao lado do título da rota; o "até" só com a rota já começada hoje). */
export function previsaoDaRota(ritmo: { minutos: number; amostras: number } | null, paradas: number, jaComecou: boolean, agora = new Date()): { texto: string; dica: string } | null {
  if (!ritmo || !paradas) return null;
  const duracao = ritmo.minutos * paradas;
  let texto = '· ~' + duracaoTexto(duracao);
  if (jaComecou) {
    const fim = new Date(agora.getTime() + duracao * 60000);
    texto += ' · até ' + String(fim.getHours()).padStart(2, '0') + ':' + String(fim.getMinutes()).padStart(2, '0');
  }
  return { texto, dica: 'No seu ritmo: ≈ ' + ritmo.minutos + ' min por parada (' + ritmo.amostras + ' entregas medidas)' };
}

/** As entregas confirmadas hoje (o ouvinte de hoje mais o painel, sem repetir). */
export function confirmadasHoje<T extends Pick<Entrega, 'id' | 'confirmadoEm'>>(listas: readonly (readonly T[])[], hoje = new Date()): T[] {
  const vistos = new Set<string>();
  const dia = hoje.toDateString();
  return listas.flat().filter(e => {
    if (!e.confirmadoEm || vistos.has(e.id)) return false;
    vistos.add(e.id);
    return new Date(e.confirmadoEm).toDateString() === dia;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// os vencimentos da semana e as obrigações do mês
// ---------------------------------------------------------------------------------------------------------------------
export function diasAte(iso: string, hoje = new Date()): number | null {
  if (!iso) return null;
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const alvo = new Date(iso.slice(0, 10) + 'T00:00:00');
  if (isNaN(alvo.getTime())) return null;
  return Math.round((alvo.getTime() - h.getTime()) / 86400000);
}
export function textoPrazo(dias: number): string {
  if (dias < 0) return 'venceu há ' + Math.abs(dias) + (Math.abs(dias) === 1 ? ' dia' : ' dias');
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return 'vence em ' + dias + ' dias';
}
/** As paradas que vencem em até 7 dias (ou já venceram), a mais urgente primeiro. */
export function vencimentosDaRota<T extends Pick<Entrega, 'vencimento'>>(pendentes: readonly T[], hoje = new Date()): { e: T; dias: number }[] {
  return pendentes.map(e => ({ e, dias: diasAte(e.vencimento, hoje) }))
    .filter((x): x is { e: T; dias: number } => x.dias !== null && x.dias <= 7)
    .sort((a, b) => a.dias - b.dias);
}
export const LIMITE_VENCIMENTOS_VISIVEL = 6;

export interface Obrigacao { id: string; nome: string; dia: number; casa: string }
/** As datas que mandam no mês do escritório (OBRIGACOES_PADRAO_; o admin muda em config/obrigacoes). */
export const OBRIGACOES_PADRAO: readonly Obrigacao[] = [
  { id: 'fgts', nome: 'FGTS', dia: 7, casa: 'FGTS' },
  { id: 'esocial', nome: 'DAE do eSocial (doméstico)', dia: 7, casa: 'eSocial|DAE' },
  { id: 'darf', nome: 'DARF / INSS', dia: 20, casa: 'DARF|INSS|prolabore|pró-labore' },
  { id: 'das', nome: 'DAS do Simples', dia: 20, casa: 'DAS' },
  { id: 'icms', nome: 'ICMS', dia: 9, casa: 'ICMS' },
];
export function obrigacoesDoDocumento(d: Record<string, unknown> | null | undefined): Obrigacao[] {
  const itens = d && Array.isArray(d.itens) ? (d.itens as Record<string, unknown>[]) : [];
  const l = itens.map((o, i) => ({ id: String(o?.id || 'o' + i), nome: String(o?.nome || ''), dia: Number(o?.dia), casa: String(o?.casa || '') }));
  return l.length ? l : [...OBRIGACOES_PADRAO];
}
export function proximaDataDaObrigacao(dia: number, hoje = new Date()): Date {
  let d = ajustarDiaUtil(new Date(hoje.getFullYear(), hoje.getMonth(), dia), 'antecipa');
  if (d < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) d = ajustarDiaUtil(new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia), 'antecipa');
  return d;
}
/** Quantas paradas da rota têm um documento que casa com a obrigação ("DARF|INSS"). */
export function guiasNaRotaDe(casa: string, pendentes: readonly Pick<Entrega, 'itens'>[]): number {
  if (!casa) return 0;
  let re: RegExp;
  try { re = new RegExp(casa, 'i'); } catch { return 0; }
  return pendentes.filter(e => e.itens.some(i => re.test(i.tipo))).length;
}
export interface ObrigacaoNoMes { obrigacao: Obrigacao; data: Date; dias: number; naRota: number; classe: '' | 'hoje' | 'perto' }
/** As 5 próximas obrigações (a data cai pra trás no fim de semana e no feriado). */
export function obrigacoesDoMes(lista: readonly Obrigacao[], pendentes: readonly Pick<Entrega, 'itens'>[], hoje = new Date()): ObrigacaoNoMes[] {
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return lista.filter(o => o && o.nome && o.dia >= 1 && o.dia <= 28)
    .map(o => {
      const data = proximaDataDaObrigacao(Number(o.dia), hoje);
      const dias = Math.round((data.getTime() - h.getTime()) / 864e5);
      return { obrigacao: o, data, dias, naRota: guiasNaRotaDe(o.casa, pendentes), classe: (dias === 0 ? 'hoje' : dias <= 3 ? 'perto' : '') as ObrigacaoNoMes['classe'] };
    })
    .sort((a, b) => a.data.getTime() - b.data.getTime()).slice(0, 5);
}

// ---------------------------------------------------------------------------------------------------------------------
// a qualidade da rota (só o admin): sem região, endereço impreciso; quem está na rota primeiro
// ---------------------------------------------------------------------------------------------------------------------
export const LIMITE_QUALIDADE_VISIVEL = 8;
export function qualidadeDaRota(clientes: readonly ClienteDaRota[], pendentes: readonly Pick<Entrega, 'clienteId'>[]) {
  const naRota = new Set(pendentes.map(e => e.clienteId).filter(Boolean) as string[]);
  const ordem = (a: ClienteDaRota, b: ClienteDaRota) => (naRota.has(a.id) ? 0 : 1) - (naRota.has(b.id) ? 0 : 1) || a.nome.localeCompare(b.nome, 'pt-BR');
  const ativos = clientesDeEntrega(clientes, pendentes);
  // o aglutinado usa o ponto e a região de quem ele segue: corrigir aqui seria corrigir o cliente errado
  return {
    naRota,
    semZona: ativos.filter(c => !c.zona && !c.grupoLocal).sort(ordem),
    enderecoImpreciso: ativos.filter(c => !c.grupoLocal && !pontoConfiavel(c)).sort(ordem),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// a ordem fixa da rota (config/rotaPadrao): uma lista por região
// ---------------------------------------------------------------------------------------------------------------------
/** As regiões da ordem fixa (ZONAS_DA_ROTA_: aqui a central se chama "Centro"). */
export const ZONAS_DA_ORDEM_FIXA: readonly { id: 'superior' | 'central' | 'inferior'; rotulo: string }[] = [
  { id: 'superior', rotulo: 'Parte superior' }, { id: 'central', rotulo: 'Centro' }, { id: 'inferior', rotulo: 'Parte inferior' },
];
export type EstadoDaOrdemFixa = Record<'superior' | 'central' | 'inferior', string[]>;
export function estadoDaOrdemFixa(fixa: RotaPadrao, existe: (id: string) => boolean): EstadoDaOrdemFixa {
  const r: EstadoDaOrdemFixa = { superior: [], central: [], inferior: [] };
  for (const [id, z] of Object.entries(fixa.zonas)) if (z in r && existe(id)) r[z as keyof EstadoDaOrdemFixa].push(id);
  for (const z of Object.keys(r) as (keyof EstadoDaOrdemFixa)[]) r[z].sort((a, b) => (fixa.ordem[a] || 0) - (fixa.ordem[b] || 0));
  return r;
}
export function rotaPadraoDoEstado(e: EstadoDaOrdemFixa): RotaPadrao {
  const zonas: Record<string, string> = {}, ordem: Record<string, number> = {};
  for (const z of ZONAS_DA_ORDEM_FIXA) e[z.id].forEach((id, i) => { zonas[id] = z.id; ordem[id] = i + 1; });
  return { zonas, ordem };
}

// ---------------------------------------------------------------------------------------------------------------------
// os protocolos do período e o fechamento do dia
// ---------------------------------------------------------------------------------------------------------------------
export const quemEntregou = (e: Pick<Entrega, 'entregadoPorNome' | 'entregadoPor'>) => e.entregadoPorNome || e.entregadoPor || '';
/** As pessoas (para o filtro "Quem entregou"/"Pessoa"), em ordem alfabética. */
export const pessoasDasEntregas = (l: readonly Pick<Entrega, 'entregadoPorNome' | 'entregadoPor'>[]) =>
  [...new Set(l.map(quemEntregou).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/** A busca dos protocolos: nome, código, CNPJ ou documento do cliente; e o filtro de quem entregou. */
export function protocolosVisiveis(lista: readonly Entrega[], busca: string, pessoa: string, clientes: ReadonlyMap<string, ClienteDaRota>): Entrega[] {
  const b = textoNormalizado(busca.trim());
  return lista.filter(e => {
    if (pessoa && quemEntregou(e) !== pessoa) return false;
    if (!b) return true;
    const c = e.clienteId ? clientes.get(e.clienteId) : null;
    return textoNormalizado([e.clienteNome, c?.codigoOrigem, c?.documento].filter(Boolean).join(' ')).includes(b);
  });
}
/** A janela do período em ISO (a meia-noite daqui do "de" até a meia-noite depois do "até"); invertido, desinverte. */
export function janelaDoPeriodo(de: string, ate: string): { de: string; ate: string; inicio: string; fim: string } {
  const [a, b] = de > ate ? [ate, de] : [de, ate];
  const fim = new Date(b + 'T00:00:00');
  fim.setDate(fim.getDate() + 1);
  return { de: a, ate: b, inicio: new Date(a + 'T00:00:00').toISOString(), fim: fim.toISOString() };
}
/** O dia da entrega no fuso daqui ('AAAA-MM-DD'). */
export function diaLocal(isoData: string): string {
  const d = new Date(isoData);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/** O comprovante da entrega numa palavra (o fechamento do dia). */
export function comprovanteEmPalavras(e: Pick<Entrega, 'recebidoPeloLink' | 'temAssinatura' | 'semAssinatura' | 'temFoto' | 'semComprovante'>): string {
  if (e.recebidoPeloLink) return 'pelo link';
  if (e.temAssinatura) return 'assinatura';
  if (e.semAssinatura) return 'foto, sem assinatura';
  if (e.temFoto) return 'foto';
  if (e.semComprovante) return 'sem comprovante';
  return '—';
}
/** O fechamento do dia: as entregues e as não entregues, na ordem da hora, e quanto cada pessoa fez. */
export function fechamentoDoDia(lista: readonly Entrega[], dia: string) {
  const doDia = lista.filter(e => e.confirmadoEm && diaLocal(e.confirmadoEm) === dia).sort((a, b) => String(a.confirmadoEm).localeCompare(String(b.confirmadoEm)));
  const porPessoa = new Map<string, { e: number; f: number }>();
  for (const e of doDia) {
    const q = quemEntregou(e) || 'sem registro';
    const p = porPessoa.get(q) || { e: 0, f: 0 };
    if (e.status === 'confirmada') p.e++; else p.f++;
    porPessoa.set(q, p);
  }
  return {
    entregues: doDia.filter(e => e.status === 'confirmada'),
    falhas: doDia.filter(e => e.status === 'falha'),
    porPessoa: [...porPessoa.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([nome, n]) => ({ nome, entregues: n.e, falhas: n.f })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// a fila pública (rotaLinks): quantas paradas faltam até a do cliente, só com o código (nunca o nome de outra empresa)
// ---------------------------------------------------------------------------------------------------------------------
export interface LinkDeRota { id: string; clienteChave: string; zona: string | null; concluida: boolean; paradasAntes: string[]; estimativaMinutos: number | null; expiraEm: string; portal: boolean }
export function linkDeRotaDoDocumento(id: string, d: Record<string, unknown>): LinkDeRota {
  return {
    id, clienteChave: String(d.clienteChave || ''), zona: d.zona ? String(d.zona) : null, concluida: !!d.concluida,
    paradasAntes: Array.isArray(d.paradasAntes) ? d.paradasAntes.map(String) : [],
    estimativaMinutos: typeof d.estimativaMinutos === 'number' ? d.estimativaMinutos : null, expiraEm: String(d.expiraEm || ''), portal: !!d.portal,
  };
}
/**
 * A projeção de um link: as paradas antes da do cliente (pelo código) e a estimativa; `mudou` só quando a fila mudou (a
 * estimativa sozinha não regrava: dois aparelhos com números diferentes ficavam corrigindo um ao outro, 25/09/2026).
 */
export function projecaoDoLink(link: LinkDeRota, ordenadas: readonly Entrega[], clientes: ReadonlyMap<string, ClienteDaRota>, ritmo: { minutos: number } | null) {
  const daFila = link.zona ? ordenadas.filter(e => e.zona === link.zona) : ordenadas;
  const chaves: string[] = [];
  const codigos = new Map<string, string>();
  for (const e of daFila) {
    const k = chaveDaParada(e, clientes);
    if (codigos.has(k)) continue;
    chaves.push(k);
    const doParada = daFila.filter(x => chaveDaParada(x, clientes) === k);
    codigos.set(k, [...new Set(doParada.map(x => (x.clienteId ? clientes.get(x.clienteId)?.codigoOrigem : '') || 'sem código'))].join(' + '));
  }
  const idx = chaves.indexOf(link.clienteChave);
  const concluida = idx === -1;
  const paradasAntes = concluida ? [] : chaves.slice(0, idx).map(k => codigos.get(k) || '');
  const estimativaMinutos = !concluida && ritmo ? Math.round(ritmo.minutos * paradasAntes.length) : null;
  const mudou = concluida !== link.concluida || JSON.stringify(paradasAntes) !== JSON.stringify(link.paradasAntes)
    || (link.estimativaMinutos === null && estimativaMinutos !== null);
  return { concluida, paradasAntes, estimativaMinutos, mudou };
}

/** O total de uma parada (várias entregas): a soma dos valores de todas. */
export const totalDaParada = (l: readonly Pick<Entrega, 'itens'>[]) => Math.round(l.reduce((s, e) => s + e.itens.reduce((t, i) => t + (i.valor || 0), 0), 0) * 100) / 100;
/** As entregas de uma parada, com os documentos (o subtítulo "Assinar as N"). */
export const resumoDaParada = (l: readonly Pick<Entrega, 'itens'>[]) => l.map(e => textoDosItens(e.itens)).join(' · ');
/** A hora da entrega (a linha dos protocolos). */
export const horaDaEntrega = (e: Pick<Entrega, 'confirmadoEm' | 'criadoEm'>) => new Date(quandoFoi(e)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
