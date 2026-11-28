// A "Impressão de campos da consulta" dos lançamentos do SCI (25/11/2026: "To querendo adicionar uma funcao de visualizar esses
// lancamentos ... um olhinho, que joga pra outra tela, importa esse razao para exergar melhor"): a planilha que o SCI exporta da
// consulta de lançamentos (.xls), com o que já está lá dentro (os lançamentos on-line do fiscal e da folha, os digitados). Só para
// ver: nada volta para o SCI.
//
// O SCI põe uma coluna vazia entre cada campo e o título na primeira linha; as colunas são achadas pelo título, não pela posição.
// O valor vem como número ou como texto no jeito americano ("2,700.00"); a data, como texto ("31/10/2026") ou número do Excel.
import * as XLSX from 'xlsx';
import { contaDoPlano, planoDoSci, planosDoSci, semAcento, type IdDoPlanoSci } from './plano';

/** Um lançamento como o SCI mostra na consulta. Na folha, cada partida vem numa linha, com um lado só. */
export interface LancamentoDaConsulta {
  /** aaaa-mm-dd ('' = sem data) */
  data: string;
  debito: string;
  credito: string;
  /** centavos, sempre positivo */
  valor: number;
  /** o número do histórico padrão ('' = sem) */
  historico: string;
  complemento: string;
  documento: string;
  /** "Lançamento on-line fiscal", "Lançamento on-line folha"... */
  tipo: string;
  participanteD: string;
  participanteC: string;
  /** aaaa-mm-dd: quando entrou no SCI e a última alteração */
  lancadoEm: string;
  alteradoEm: string;
  /**
   * a coluna Lote (27/11/2026): no SCI é a primeira coluna da consulta e sai na planilha SEM título; o que o minimum importou leva
   * ali o lote e a chave do lançamento (M583EDT001). Ausente nas consultas guardadas antes disso.
   */
  lote?: string;
  /**
   * a contrapartida da partida de um lado só (27/11/2026: a folha e a "Baixa de cálculo" vêm partidas em duas linhas, '' × 84 e
   * 1368 × '', com a mesma data, o mesmo valor e o mesmo complemento): a conta do outro lado, achada por juntarPartidas. Não entra na
   * soma (a outra linha já soma do lado dela); serve para mostrar.
   */
  contrapartida?: string;
}

type Campo = Exclude<keyof LancamentoDaConsulta, 'contrapartida'>;
/** os títulos de cada campo, sem acento e em minúsculas */
const TITULOS: Record<Campo, readonly string[]> = {
  data: ['data'], debito: ['debito'], credito: ['credito'], valor: ['valor'], historico: ['historico'], complemento: ['complemento'],
  documento: ['n doc.', 'n doc', 'no doc.', 'documento'], tipo: ['tipo de lancamento'],
  participanteD: ['participante a debito'], participanteC: ['participante a credito'],
  lancadoEm: ['data lancamento', 'data do lancamento'], alteradoEm: ['data ultima alteracao', 'data da ultima alteracao'],
  lote: ['lote'],
};
const titulo = (v: unknown) => semAcento(String(v ?? '')).replace(/[º°]/g, '').replace(/\s+/g, ' ').trim();

/** 'dd/mm/aaaa' ou o número do Excel → 'aaaa-mm-dd' ('' quando não é data) */
export function dataDaConsulta(v: unknown): string {
  if (typeof v === 'number' && v > 0) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? d.y + '-' + String(d.m).padStart(2, '0') + '-' + String(d.d).padStart(2, '0') : '';
  }
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v ?? '').trim());
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
}

/**
 * O valor em centavos: número, ou texto no jeito americano ("2,700.00") ou no brasileiro ("2.700,00"). O separador que vem por
 * último é o decimal; com um só, ele é o decimal quando tem até duas casas depois. NaN quando não é valor.
 */
export function valorDaConsulta(v: unknown): number {
  if (typeof v === 'number') return Math.round(Math.abs(v) * 100);
  let t = String(v ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '').replace(/^-/, '');
  if (!t) return NaN;
  const ponto = t.lastIndexOf('.');
  const virgula = t.lastIndexOf(',');
  const dec = Math.max(ponto, virgula);
  if (dec >= 0) {
    const sep = t[dec];
    const decimal = (ponto >= 0 && virgula >= 0) || t.length - dec - 1 <= 2;
    t = decimal ? t.slice(0, dec).replace(/[.,]/g, '') + '.' + t.slice(dec + 1) : t.split(sep).join('');
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

/** As linhas da planilha (a primeira aba, em matriz) → os lançamentos; null quando não é a consulta do SCI (sem os títulos). */
export function lancamentosDaConsulta(aoa: readonly (readonly unknown[])[]): LancamentoDaConsulta[] | null {
  const i = aoa.slice(0, 20).findIndex(r => {
    const ts = r.map(titulo);
    return ts.includes('data') && ts.includes('debito') && ts.includes('credito') && ts.includes('valor');
  });
  if (i < 0) return null;
  const ts = aoa[i].map(titulo);
  const col = Object.fromEntries((Object.keys(TITULOS) as Campo[]).map(c => [c, ts.findIndex(t => TITULOS[c].includes(t))])) as Record<Campo, number>;
  // o Lote sai sem título, na primeira coluna (a consulta do Vitor, 27/11/2026)
  if (col.lote < 0 && ts.length && !ts[0]) col.lote = 0;
  const texto = (r: readonly unknown[], c: Campo) => (col[c] < 0 ? '' : String(r[col[c]] ?? '').trim());
  const lidos: LancamentoDaConsulta[] = [];
  for (const r of aoa.slice(i + 1)) {
    const valor = col.valor < 0 ? NaN : valorDaConsulta(r[col.valor]);
    const data = col.data < 0 ? '' : dataDaConsulta(r[col.data]);
    if (!data && !Number.isFinite(valor)) continue;
    lidos.push({
      data, debito: texto(r, 'debito'), credito: texto(r, 'credito'), valor: Number.isFinite(valor) ? valor : 0,
      historico: texto(r, 'historico'), complemento: texto(r, 'complemento'), documento: texto(r, 'documento'), tipo: texto(r, 'tipo'),
      participanteD: texto(r, 'participanteD'), participanteC: texto(r, 'participanteC'),
      lancadoEm: col.lancadoEm < 0 ? '' : dataDaConsulta(r[col.lancadoEm]), alteradoEm: col.alteradoEm < 0 ? '' : dataDaConsulta(r[col.alteradoEm]),
      lote: texto(r, 'lote').toUpperCase(),
    });
  }
  return juntarPartidas(lidos);
}

/**
 * Junta as partidas de um lado só (27/11/2026): a linha só com o débito e a linha só com o crédito, com a mesma data, o mesmo valor,
 * o mesmo complemento e o mesmo tipo, são o mesmo lançamento; cada uma ganha a conta da outra em `contrapartida`. Em ordem, uma com a
 * outra (duas partidas iguais no mesmo dia casam a 1ª com a 1ª). As de dois lados ficam como estão.
 */
export function juntarPartidas<T extends LancamentoDaConsulta>(ls: readonly T[]): T[] {
  const chave = (l: LancamentoDaConsulta) => [l.data, l.valor, l.complemento.trim(), l.tipo].join('\u0001');
  const soCredito = new Map<string, number[]>();
  ls.forEach((l, i) => { if (!l.debito && l.credito) soCredito.set(chave(l), [...(soCredito.get(chave(l)) || []), i]); });
  const r = ls.map(l => ({ ...l }));
  ls.forEach((l, i) => {
    if (!l.debito || l.credito) return;
    const fila = soCredito.get(chave(l));
    const j = fila?.shift();
    if (j == null) return;
    r[i].contrapartida = ls[j].credito;
    r[j].contrapartida = l.debito;
  });
  return r;
}

/**
 * O arquivo (.xls, .xlsx ou .csv) → os lançamentos da primeira aba; null quando não é a consulta do SCI. O .xls e o .xlsx (que
 * começam pela assinatura do Office ou do zip) vão direto; o resto é texto: UTF-8 e, se não for, Windows-1252, para os acentos dos
 * títulos ("Débito") chegarem certos.
 */
export function lerConsultaDoSci(bytes: ArrayBuffer | Uint8Array): LancamentoDaConsulta[] | null {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const office = (u[0] === 0xd0 && u[1] === 0xcf && u[2] === 0x11 && u[3] === 0xe0) || (u[0] === 0x50 && u[1] === 0x4b);
  let wb: XLSX.WorkBook;
  if (office) wb = XLSX.read(u, { type: 'array', raw: true });
  else {
    let texto: string;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(u); } catch { texto = new TextDecoder('windows-1252').decode(u); }
    wb = XLSX.read(texto.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return null;
  return lancamentosDaConsulta(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: '' }));
}

/**
 * O plano do SCI em que as contas da consulta existem (25/11/2026: "Coloca o nome logo relacionado ao plano de contas"): o arquivo
 * pode ser de uma empresa noutro plano padrão; ganha o que reconhece mais contas, e no empate fica o da empresa (o preferido).
 */
export function planoDaConsulta(ls: readonly LancamentoDaConsulta[], preferido: IdDoPlanoSci): IdDoPlanoSci {
  const codigos = [...new Set(ls.flatMap(l => [l.debito, l.credito]).filter(Boolean))];
  const conta = (id: IdDoPlanoSci) => { const p = planoDoSci(id); return codigos.filter(c => contaDoPlano(p, c)).length; };
  let melhor = preferido;
  let max = conta(preferido);
  for (const { id } of planosDoSci()) { const n = conta(id); if (n > max) { melhor = id; max = n; } }
  return melhor;
}

/**
 * O nome de cada participante (25/11/2026: "participante tbm, quero os nomes"): a consulta só traz o código, mas no lançamento
 * on-line do fiscal o complemento é "<nº da nota> - <NOME>", e a nota é o documento. Vale o primeiro nome achado de cada código.
 */
export function nomesDosParticipantes(ls: readonly LancamentoDaConsulta[]): ReadonlyMap<string, string> {
  const nomes = new Map<string, string>();
  for (const l of ls) {
    const m = /^\s*(\d+)\s*-\s*(.+?)\s*$/.exec(l.complemento);
    if (!m || !l.documento || m[1] !== l.documento.trim()) continue;
    for (const p of [l.participanteD, l.participanteC]) if (p && !nomes.has(p)) nomes.set(p, m[2]);
  }
  return nomes;
}

// ---------- juntar o que o robô puxa (27/11/2026, Vitor: "Puxa tudo de inicio e ao longo do tempo vai colocando so os lancamentos
// novos. Se a pessoa pedir um mes em especifico, ai vc puxa") ----------

/**
 * O período de uma competência do SCI (MM/AAAA): '10/2026' → outubro; '00/2026' → o ano todo; '00/0000' → null (tudo).
 * A consulta do SCI sai sem filtro (o robô retira o filtro), com tudo da empresa: o período é aplicado aqui.
 */
export function periodoDaCompetenciaDoSci(c: string): { de: string; ate: string } | null {
  const m = /^(\d{2})\/(\d{4})$/.exec(c);
  if (!m || m[2] === '0000') return null;
  const mes = Number(m[1]);
  if (!mes) return { de: m[2] + '-01-01', ate: m[2] + '-12-31' };
  const ultimo = new Date(Date.UTC(Number(m[2]), mes, 0)).getUTCDate();
  return { de: m[2] + '-' + m[1] + '-01', ate: m[2] + '-' + m[1] + '-' + String(ultimo).padStart(2, '0') };
}

/** o que identifica um lançamento da consulta (sem a data da última alteração: o mesmo lançamento, alterado, muda os campos) */
const chaveDaConsulta = (l: LancamentoDaConsulta) =>
  [l.data, l.debito, l.credito, l.valor, l.historico, l.complemento, l.documento, l.tipo, l.participanteD, l.participanteC, l.lancadoEm, l.lote || ''].join('\u0001');

export interface ConsultasJuntas {
  lancamentos: LancamentoDaConsulta[];
  /** quantos entraram que não estavam (no "tudo"), ou quantos o período tem agora (no mês ou no ano) */
  novos: number;
  /** o período pedido, se não foi tudo */
  periodo: { de: string; ate: string } | null;
}

/**
 * Junta a consulta que o robô puxou com a que a tela já tem:
 *  - tudo (00/0000): entra só o que é novo (o mesmo lançamento repetido conta quantas vezes aparece); o que já estava fica;
 *  - um mês ou um ano: o período é trocado pelo que veio dele (o que foi alterado ou excluído no SCI se acerta); o resto fica.
 */
export function juntarConsultas(antigos: readonly LancamentoDaConsulta[], chegados: readonly LancamentoDaConsulta[], competencia: string): ConsultasJuntas {
  const periodo = periodoDaCompetenciaDoSci(competencia);
  if (periodo) {
    const dentro = (l: LancamentoDaConsulta) => !!l.data && l.data >= periodo.de && l.data <= periodo.ate;
    const doPeriodo = chegados.filter(dentro);
    return { lancamentos: [...doPeriodo, ...antigos.filter(l => !dentro(l))], novos: doPeriodo.length, periodo };
  }
  // tudo: a ordem do SCI; o que só a tela tinha (excluído no SCI depois) vai no fim
  const conta = new Map<string, number>();
  for (const l of antigos) { const k = chaveDaConsulta(l); conta.set(k, (conta.get(k) || 0) + 1); }
  let novos = 0;
  for (const l of chegados) {
    const k = chaveDaConsulta(l);
    const n = conta.get(k) || 0;
    if (n) conta.set(k, n - 1); else novos++;
  }
  const sobra: LancamentoDaConsulta[] = [];
  for (const l of antigos) {
    const k = chaveDaConsulta(l);
    const n = conta.get(k) || 0;
    if (n) { sobra.push(l); conta.set(k, n - 1); }
  }
  return { lancamentos: [...chegados, ...sobra], novos, periodo: null };
}
