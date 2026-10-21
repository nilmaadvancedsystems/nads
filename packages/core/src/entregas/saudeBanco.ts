// A saúde do banco no site do admin (Vitor, 21/10/2026: "quero um site específico só para quem é admin, para ter acesso a
// desempenho do robô, uso de sistema, saúde do banco de dados e coisas assim"). Só leitura, de duas fontes do banco do
// Entregas que o robô da nuvem grava (o app nunca fala com o Google):
//   robo/uso          {desde, em, leituras, gravacoes, exclusoes, erro}  o consumo de hoje (desde a meia-noite da Califórnia,
//                     quando a cota grátis zera), perguntado ao Cloud Monitoring a cada 15 min (robo/uso-banco.js)
//   robo/saudeBanco   o resumo de uma vez por dia (robo/saude-banco.js): o tamanho de cada coleção (e o de 7 dias atrás),
//                     os documentos órfãos (subcoleções sem o documento de cima, como o espelho da Área do Cliente sem o
//                     link), o consumo dos últimos 30 dias, o armazenamento do Firestore e a hospedagem
// Nenhum número é inventado: o que o robô não mediu fica sem número ("sem medição"), com o erro dele quando houver.

import type { ErroNaFila, ItemDaSaude, TomDaSaude } from './saude';
import type { LinhaDaFila } from './painelRobo';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const txt = (v: unknown) => (v == null ? '' : String(v));
/** número de verdade, ou null (sem medição) */
const numOuNada = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const num = (v: unknown) => numOuNada(v) ?? 0;
const lista = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(obj) : []);
const MIN = 60 * 1000;
const HORA = 60 * MIN;
const idade = (iso: string, agora: number) => { const t = Date.parse(iso); return Number.isFinite(t) ? agora - t : Infinity; };
const milhar = (n: number) => n.toLocaleString('pt-BR');

/** A cota grátis do Firestore (plano Spark) por dia; zera à meia-noite da Califórnia. */
export const COTA_GRATIS_DO_BANCO = { leituras: 50000, gravacoes: 20000, exclusoes: 20000 } as const;
/** O armazenamento grátis do Firestore (1 GiB). */
export const ARMAZENAMENTO_GRATIS_BYTES = 1024 ** 3;

export type CampoDoUso = keyof typeof COTA_GRATIS_DO_BANCO;
export const CAMPOS_DO_USO: readonly { id: CampoDoUso; rotulo: string }[] = [
  { id: 'leituras', rotulo: 'Leituras' }, { id: 'gravacoes', rotulo: 'Gravações' }, { id: 'exclusoes', rotulo: 'Exclusões' },
];

/** O consumo de hoje (robo/uso). */
export interface UsoDeHoje { em: string; desde: string; leituras: number; gravacoes: number; exclusoes: number; erro: string }

export interface UsoDoDiaNoBanco { dia: string; leituras: number; gravacoes: number; exclusoes: number }
export interface ColecaoNoBanco { nome: string; total: number; /** o total de 7 dias atrás (null: o robô ainda não tinha medido) */ ha7dias: number | null }
export interface OrfaosNoBanco {
  colecao: string; rotulo: string; quantos: number;
  /** até 5 ids (o começo), para achar no console */
  exemplos: string[];
  /** a coleção era grande demais para conferir hoje, ou deu erro */
  erro: string;
}
export interface SiteNaHospedagem { site: string; bytes: number }
export interface HospedagemNoBanco {
  projeto: string; bytes: number | null; limite: number | null; enviadoNoMes: number | null; limiteDeEnvio: number | null;
  sites: SiteNaHospedagem[]; erro: string;
}

/** O resumo diário (robo/saudeBanco). */
export interface ResumoDaSaudeDoBanco {
  em: string;
  dia: string;
  /** quanto o próprio resumo gastou (leituras estimadas) e demorou */
  leiturasGastas: number;
  duracaoMs: number;
  colecoes: ColecaoNoBanco[];
  orfaos: OrfaosNoBanco[];
  /** os dias completos (o de hoje está no robo/uso), do mais antigo ao mais novo */
  usoPorDia: UsoDoDiaNoBanco[];
  armazenamento: { bytes: number | null; erro: string };
  hospedagem: HospedagemNoBanco[];
  /** o que não deu para medir (uma linha cada) */
  erros: string[];
}

/** O robo/uso como veio do banco (null sem documento). */
export function lerUsoDeHoje(d: Obj | null | undefined): UsoDeHoje | null {
  if (!d) return null;
  return { em: txt(d.em), desde: txt(d.desde), leituras: num(d.leituras), gravacoes: num(d.gravacoes), exclusoes: num(d.exclusoes), erro: txt(d.erro) };
}

/** O robo/saudeBanco como veio do banco (null sem documento). */
export function lerResumoDaSaudeDoBanco(d: Obj | null | undefined): ResumoDaSaudeDoBanco | null {
  if (!d) return null;
  const arm = obj(d.armazenamento);
  return {
    em: txt(d.em), dia: txt(d.dia), leiturasGastas: num(d.leiturasGastas), duracaoMs: num(d.duracaoMs),
    colecoes: lista(d.colecoes).map(c => ({ nome: txt(c.nome), total: num(c.total), ha7dias: numOuNada(c.ha7dias) })).filter(c => c.nome),
    orfaos: lista(d.orfaos).map(o => ({
      colecao: txt(o.colecao), rotulo: txt(o.rotulo) || txt(o.colecao), quantos: num(o.quantos),
      exemplos: Array.isArray(o.exemplos) ? o.exemplos.map(txt).slice(0, 5) : [], erro: txt(o.erro),
    })).filter(o => o.colecao),
    usoPorDia: lista(d.usoPorDia).map(u => ({ dia: txt(u.dia), leituras: num(u.leituras), gravacoes: num(u.gravacoes), exclusoes: num(u.exclusoes) }))
      .filter(u => /^\d{4}-\d{2}-\d{2}$/.test(u.dia)).sort((a, b) => a.dia.localeCompare(b.dia)),
    armazenamento: { bytes: numOuNada(arm.bytes), erro: txt(arm.erro) },
    hospedagem: lista(d.hospedagem).map(h => ({
      projeto: txt(h.projeto), bytes: numOuNada(h.bytes), limite: numOuNada(h.limite), enviadoNoMes: numOuNada(h.enviadoNoMes),
      limiteDeEnvio: numOuNada(h.limiteDeEnvio), erro: txt(h.erro),
      sites: lista(h.sites).map(s => ({ site: txt(s.site), bytes: num(s.bytes) })).filter(s => s.site).sort((a, b) => b.bytes - a.bytes),
    })).filter(h => h.projeto),
    erros: Array.isArray(d.erros) ? d.erros.map(txt).filter(Boolean) : [],
  };
}

/** O tom de quanto da cota foi usado: a partir de 70% atenção, de 90% erro. */
export function tomDaCota(pct: number | null): TomDaSaude {
  if (pct === null) return 'neutro';
  return pct >= 90 ? 'erro' : pct >= 70 ? 'aviso' : 'ok';
}

/** "1,2 GB", "340 MB", "12 KB" ('—' sem número). */
export function formatarBytes(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < unidades.length - 1) { v /= 1024; i++; }
  return (i === 0 ? String(Math.round(v)) : v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })) + ' ' + unidades[i];
}

/** Uma linha de cota: o usado, o limite, a porcentagem e o tom. */
export interface LinhaDaCota { id: string; rotulo: string; usado: number | null; limite: number | null; pct: number | null; tom: TomDaSaude; texto: string }

const pctDe = (usado: number | null, limite: number | null) => (usado === null || !limite ? null : Math.round((usado / limite) * 1000) / 10);

/** O consumo de hoje contra a cota grátis (sem robo/uso, ou com erro, as linhas ficam sem número). */
export function cotaDeHoje(uso: UsoDeHoje | null): LinhaDaCota[] {
  return CAMPOS_DO_USO.map(c => {
    const usado = uso && !uso.erro ? uso[c.id] : null;
    const limite = COTA_GRATIS_DO_BANCO[c.id];
    const pct = pctDe(usado, limite);
    return { id: c.id, rotulo: c.rotulo, usado, limite, pct, tom: tomDaCota(pct),
      texto: usado === null ? 'sem medição' : milhar(usado) + ' de ' + milhar(limite) + ' (' + (pct ?? 0).toLocaleString('pt-BR') + '%)' };
  });
}

/** O armazenamento do Firestore e a hospedagem de cada projeto contra o limite (só o que o robô mediu). */
export function cotaDoArmazenamento(r: ResumoDaSaudeDoBanco | null): LinhaDaCota[] {
  if (!r) return [];
  const linhas: LinhaDaCota[] = [];
  const b = r.armazenamento.bytes;
  const pf = pctDe(b, ARMAZENAMENTO_GRATIS_BYTES);
  linhas.push({ id: 'firestore', rotulo: 'Banco (Firestore)', usado: b, limite: ARMAZENAMENTO_GRATIS_BYTES, pct: pf, tom: tomDaCota(pf),
    texto: b === null ? 'sem medição' : formatarBytes(b) + ' de ' + formatarBytes(ARMAZENAMENTO_GRATIS_BYTES) + ' (' + (pf ?? 0).toLocaleString('pt-BR') + '%)' });
  for (const h of r.hospedagem) {
    const p = pctDe(h.bytes, h.limite);
    linhas.push({ id: 'hosp-' + h.projeto, rotulo: 'Hospedagem (' + h.projeto + ')', usado: h.bytes, limite: h.limite, pct: p, tom: tomDaCota(p),
      texto: h.bytes === null ? 'sem medição' : formatarBytes(h.bytes) + (h.limite ? ' de ' + formatarBytes(h.limite) + ' (' + (p ?? 0).toLocaleString('pt-BR') + '%)' : '') });
    if (h.enviadoNoMes !== null) {
      const pe = pctDe(h.enviadoNoMes, h.limiteDeEnvio);
      linhas.push({ id: 'envio-' + h.projeto, rotulo: 'Tráfego do mês (' + h.projeto + ')', usado: h.enviadoNoMes, limite: h.limiteDeEnvio, pct: pe, tom: tomDaCota(pe),
        texto: formatarBytes(h.enviadoNoMes) + (h.limiteDeEnvio ? ' de ' + formatarBytes(h.limiteDeEnvio) + ' (' + (pe ?? 0).toLocaleString('pt-BR') + '%)' : '') });
    }
  }
  return linhas;
}

/** Uma coleção com o quanto cresceu em 7 dias (null sem a medição de 7 dias atrás). */
export interface ColecaoQueCresce extends ColecaoNoBanco { cresceu: number | null; pct: number | null; tom: TomDaSaude }

/** Cresce demais: mais 1.000 documentos e +50% em 7 dias; ou passou de 50 mil documentos. */
export const CRESCE_DEMAIS = { minimo: 1000, pct: 50, grande: 50000 } as const;

/** As coleções, as que mais cresceram primeiro (depois as maiores). */
export function colecoesQueCrescem(colecoes: readonly ColecaoNoBanco[]): ColecaoQueCresce[] {
  return colecoes.map(c => {
    const cresceu = c.ha7dias === null ? null : c.total - c.ha7dias;
    const pct = cresceu === null ? null : c.ha7dias ? Math.round((cresceu / c.ha7dias) * 100) : c.total ? 100 : 0;
    const demais = (cresceu !== null && cresceu >= CRESCE_DEMAIS.minimo && (pct ?? 0) >= CRESCE_DEMAIS.pct) || c.total >= CRESCE_DEMAIS.grande;
    return { ...c, cresceu, pct, tom: (demais ? 'aviso' : 'ok') as TomDaSaude };
  }).sort((a, b) => (b.cresceu ?? -Infinity) - (a.cresceu ?? -Infinity) || b.total - a.total);
}

/** A última gravação de quem grava no banco sozinho (cada robô e cada medição), com o intervalo esperado. */
export interface SinalNoBanco { id: string; rotulo: string; em: string; /** de quanto em quanto tempo grava */ esperadoMin: number }
export interface LinhaDoSinal extends SinalNoBanco { tom: TomDaSaude; ha: string }

/** "há 5 min" etc. (o mesmo do painel), '' sem data. */
function haQuanto(iso: string, agora: number): string {
  const d = idade(iso, agora);
  if (!Number.isFinite(d)) return '';
  if (d < MIN) return 'agora há pouco';
  if (d < HORA) return 'há ' + Math.floor(d / MIN) + ' min';
  if (d < 48 * HORA) return 'há ' + Math.floor(d / HORA) + ' h';
  return 'há ' + Math.floor(d / (24 * HORA)) + ' dias';
}

/** No prazo: ok; até 3 vezes o intervalo: atenção; depois, erro; sem data: neutro. */
export function sinaisNoBanco(sinais: readonly SinalNoBanco[], agora = Date.now()): LinhaDoSinal[] {
  return sinais.map(s => {
    const d = idade(s.em, agora);
    const limite = s.esperadoMin * MIN;
    const tom: TomDaSaude = !s.em || !Number.isFinite(d) ? 'neutro' : d <= limite ? 'ok' : d <= 3 * limite ? 'aviso' : 'erro';
    return { ...s, tom, ha: haQuanto(s.em, agora) };
  });
}

const PIOR: Record<TomDaSaude, number> = { erro: 3, aviso: 2, ok: 1, neutro: 0 };
/** O pior tom de uma lista (sem nada: neutro). */
export function piorTom(tons: readonly TomDaSaude[]): TomDaSaude {
  return tons.reduce<TomDaSaude>((p, t) => (PIOR[t] > PIOR[p] ? t : p), 'neutro');
}

export interface EntradaDaSaudeDoBanco {
  resumo: ResumoDaSaudeDoBanco | null;
  uso: UsoDeHoje | null;
  sinais: readonly LinhaDoSinal[];
  filas: readonly LinhaDaFila[];
  errosDaFila: readonly ErroNaFila[];
}

/** As linhas da saúde do banco ("ok / atenção / parado"), na ordem de importância. */
export function saudeDoBanco(e: EntradaDaSaudeDoBanco, agora = Date.now()): ItemDaSaude[] {
  const itens: ItemDaSaude[] = [];

  // 1. a cota de hoje
  const cota = cotaDeHoje(e.uso);
  const piorCota = cota.reduce<LinhaDaCota | null>((p, c) => (c.pct !== null && (!p || (c.pct ?? 0) > (p.pct ?? 0)) ? c : p), null);
  itens.push({
    id: 'cota', rotulo: 'Cota grátis de hoje', tom: !e.uso ? 'neutro' : e.uso.erro ? 'aviso' : piorTom(cota.map(c => c.tom)),
    texto: !e.uso ? 'O robô ainda não mediu o uso de hoje' : e.uso.erro ? 'Não consegui medir' : piorCota ? piorCota.rotulo + ': ' + piorCota.texto : 'sem medição',
    detalhe: e.uso?.erro || (e.uso ? 'Medido ' + haQuanto(e.uso.em, agora) + ' · zera à meia-noite da Califórnia' : undefined),
  });

  // 2. o resumo do dia
  const r = e.resumo;
  const velho = r ? idade(r.em, agora) > 30 * HORA : false;
  itens.push({
    id: 'resumo', rotulo: 'Resumo diário do banco', tom: !r ? 'neutro' : velho ? 'aviso' : r.erros.length ? 'aviso' : 'ok',
    texto: !r ? 'O robô ainda não publicou o resumo' : velho ? 'Atrasado: o último é ' + haQuanto(r.em, agora) : 'Feito ' + haQuanto(r.em, agora),
    detalhe: r?.erros.length ? r.erros.slice(0, 3).join(' · ') : r ? milhar(r.colecoes.length) + ' coleções conferidas · ' + milhar(r.leiturasGastas) + ' leituras gastas' : undefined,
  });

  // 3. o armazenamento
  if (r) {
    const [arm] = cotaDoArmazenamento(r);
    itens.push({ id: 'armazenamento', rotulo: 'Armazenamento do banco', tom: r.armazenamento.erro ? 'aviso' : arm.tom, texto: arm.texto, detalhe: r.armazenamento.erro || undefined });
  }

  // 4. as filas atrasadas
  const atrasadas = e.filas.filter(f => f.tom === 'aviso' || f.tom === 'erro');
  const esperando = e.filas.reduce((s, f) => s + f.esperando, 0);
  itens.push({
    id: 'filas', rotulo: 'Filas de pedidos', tom: atrasadas.some(f => f.tom === 'erro') ? 'erro' : atrasadas.length ? 'aviso' : e.filas.length ? 'ok' : 'neutro',
    texto: !e.filas.length ? 'Os robôs ainda não publicaram as filas' : atrasadas.length ? atrasadas.length + (atrasadas.length === 1 ? ' fila atrasada' : ' filas atrasadas') : milhar(esperando) + ' esperando, nenhuma atrasada',
    detalhe: atrasadas.slice(0, 3).map(f => f.nome + ' (' + f.esperando + ' esperando' + (f.espera ? ', ' + f.espera : '') + ')').join(' · ') || undefined,
  });

  // 5. os órfãos
  if (r) {
    const orfaos = r.orfaos.reduce((s, o) => s + o.quantos, 0);
    const comOrfao = r.orfaos.filter(o => o.quantos > 0);
    itens.push({
      id: 'orfaos', rotulo: 'Documentos órfãos', tom: orfaos ? 'aviso' : 'ok',
      texto: orfaos ? milhar(orfaos) + (orfaos === 1 ? ' documento órfão' : ' documentos órfãos') : 'Nenhum',
      detalhe: comOrfao.map(o => o.rotulo + ': ' + o.quantos).join(' · ') || undefined,
    });
  }

  // 6. as coleções que crescem demais
  if (r) {
    const demais = colecoesQueCrescem(r.colecoes).filter(c => c.tom === 'aviso');
    itens.push({
      id: 'crescimento', rotulo: 'Coleções que crescem demais', tom: demais.length ? 'aviso' : 'ok',
      texto: demais.length ? demais.length + (demais.length === 1 ? ' coleção' : ' coleções') : 'Nenhuma',
      detalhe: demais.slice(0, 3).map(c => c.nome + ' (' + milhar(c.total) + (c.cresceu !== null ? ', +' + milhar(c.cresceu) + ' em 7 dias' : '') + ')').join(' · ') || undefined,
    });
  }

  // 7. a última gravação de cada robô
  const parados = e.sinais.filter(s => s.tom === 'erro' || s.tom === 'aviso');
  itens.push({
    id: 'sinais', rotulo: 'Última gravação dos robôs', tom: piorTom(e.sinais.map(s => s.tom)),
    texto: parados.length ? parados.length + (parados.length === 1 ? ' atrasado' : ' atrasados') : e.sinais.some(s => s.tom === 'ok') ? 'Todos no prazo' : 'Sem sinal ainda',
    detalhe: parados.slice(0, 3).map(s => s.rotulo + ' ' + (s.ha || 'nunca')).join(' · ') || undefined,
  });

  // 8. os pedidos que deram erro nas últimas 24 h (cobrança, salvar no Drive…)
  const recentes = e.errosDaFila.filter(x => idade(x.em, agora) < 24 * HORA);
  itens.push({
    id: 'pedidos', rotulo: 'Pedidos com erro (24 h)', tom: recentes.length ? 'aviso' : 'ok',
    texto: recentes.length ? recentes.length + (recentes.length === 1 ? ' pedido deu erro' : ' pedidos deram erro') : 'Nenhum',
  });

  return itens;
}
