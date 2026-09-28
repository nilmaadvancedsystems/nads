/// <reference types="node" />
// Só para os testes de paridade: lê o conciliadorZINHO.html original do disco, recorta as
// funções pelo nome e roda SÓ elas num sandbox (new Function), com um `state` controlável e um
// `document` de mentira. Nunca roda o script inteiro. Nada aqui vai para o app.
// O XLSX do sandbox é o MESMO que o original usa: o SheetJS 0.18.5 colado no próprio HTML
// (assim a paridade também pega diferença de versão da biblioteca; a cópia usa a 0.20.3 do nads).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairFuncao, extrairVar } from '../../conferencia/__legado__/carregar';
import { lerDataFlexivel, lerNumeroFlexivel } from '../regras/formatos';

/** nads e contabil-htmls são irmãos dentro de CLAUDE_DRIVE. */
export const CAMINHO_LEGADO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../contabil-htmls/conciliadorZINHO.html');

export function temLegado(): boolean {
  return existsSync(CAMINHO_LEGADO);
}

let fonteCache: string | null = null;
export function fonteLegado(): string {
  if (fonteCache == null) fonteCache = readFileSync(CAMINHO_LEGADO, 'utf8');
  return fonteCache;
}

/** Só o código próprio do app (o IIFE depois da biblioteca), para o recorte não esbarrar no SheetJS minificado. */
function codigoProprio(src: string): string {
  const m = /\(function\(\)\{\s*"use strict";/.exec(src);
  if (!m) throw new Error('não achei o IIFE do app no legado');
  return src.slice(m.index);
}

/** O SheetJS colado no HTML (o <script> que começa com o comentário "SheetJS xlsx.core.min.js"). */
function codigoSheetJs(src: string): string {
  const marca = src.indexOf('/* SheetJS xlsx.core.min.js');
  if (marca < 0) throw new Error('não achei o SheetJS no legado');
  const fim = src.indexOf('</script>', marca);
  return src.slice(marca, fim);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type XlsxLegado = any;

// ---------- formas do original ----------
export interface MesL { month: number; year: number; count?: number }
export interface TxL { date: Date; dateKey: string; bruto: number; taxa: number }
export interface VendaL { date: Date; dateKey: string; bruto: number; nf: string; historico: string; contrapartida: string; historicoCode: string }
export interface EntradaL { tipo: 'Bruto' | 'Taxa'; matched: boolean; dateKey: string; valor: number; historico: string; complemento: string; nota: string }
export interface DatasetL { months: MesL[]; approvedCount: number; matchedCount: number; unmatchedCount: number; totalBruto: number; totalTaxa: number; entries: EntradaL[] }
export interface LinhaFinalL { devedora: string; credora: string; data: string; valor: string; valor_num: number; historico: string; complemento: string; nota: string; matched: boolean; tipo: string }
export interface LinhaSaidaL { contrapartida: string; contaVendas: string; data: string; valor: string; valor_num: number; historicoCode: string; complemento: string; nota: string }
export interface SaidaOutL { rows: LinhaSaidaL[]; month: MesL; label: string; xlsBytes: ArrayBuffer | null; plainText: string; csvText: string; filenameBase: string }
export interface FinalOutL { rows: LinhaFinalL[]; xlsBytes: ArrayBuffer | null; plainText: string; csvText: string; filenameBase: string }
export interface StateL {
  brands: string[];
  brandOrder: string[];
  brandData: Record<string, { files: { transactions: TxL[] }[]; conta: string }>;
  sales: { entries: VendaL[] | null };
  reconcileMonths: MesL[] | null;
  excludedMonths: MesL[];
  accounts: { revenda: string; taxa: string; caixaPadrao: boolean | null; caixa: string };
  datasets: Record<string, DatasetL> | null;
  leftoverSales: VendaL[] | null;
}

export interface Legado {
  XLSX: XlsxLegado;
  BRAND_META: Record<string, { label: string; slug: string; logo: string }>;
  BRAND_LIST: string[];
  usarEstado(s: StateL): void;
  /** innerHTML/textContent que as funções escreveram no document de mentira. */
  elemento(id: string): { innerHTML?: string; textContent?: string };
  finalOutputs(): Record<string, FinalOutL>;
  finalSaidaOutputs(): Record<string, SaidaOutL>;
  monthLabel(m: MesL): string;
  fmtBR(n: number): string;
  fmtBRL(n: number): string;
  fmtDate(d: Date): string;
  csvField(v: unknown): string;
  parseDateFlexible(v: unknown): Date | null;
  parseNumberFlexible(v: unknown): number | null;
  cleanHistorico(v: unknown): string;
  extractNfFromHistorico(v: unknown): string;
  parseCardStatementFile(f: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<{ ok: boolean; transactions?: TxL[]; month?: MesL }>;
  parseSalesFile(f: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<{ ok: boolean; entries?: VendaL[]; months?: MesL[]; totalRows?: number }>;
  computeMonthTally(itens: { date: Date }[]): MesL[];
  monthKey(m: MesL): string;
  monthOfDateKey(k: string): string;
  monthsSlug(ms: MesL[]): string;
  validExt(nome: string, exts: string[]): boolean;
  computeBrandOrder(): string[];
  generateMultiBrandDatasets(): { byBrand: Record<string, DatasetL>; leftoverSales: VendaL[] };
  validateTotals(): { ok: boolean; issues: string[] };
  renderTotalsBreakdown(): void;
  buildFinalOutputs(): void;
  /** O trecho de wireStep2 que compara os meses, embrulhado numa função. */
  compararMeses(cardMonths: MesL[], salesMonths: MesL[]): { extras: MesL[]; comuns: MesL[]; excluidos: MesL[] };
}

const VARS = ['MONTHS', 'BRAND_META', 'BRAND_LIST', 'BLANK_ROWS'];
const FUNCOES = [
  'monthLabel', 'fmtBR', 'fmtBRL', 'pad2', 'fmtDate', 'csvField', 'excelSerialToDate', 'parseDateFlexible', 'parseNumberFlexible',
  'parseCardStatementFile', 'cleanHistorico', 'extractNfFromHistorico', 'parseSalesFile', 'computeMonthTally', 'monthKey',
  'getAllBrandTransactions', 'getBrandTransactions', 'computeBrandOrder', 'generateMultiBrandDatasets', 'monthOfDateKey',
  'validateTotals', 'renderTotalsBreakdown', 'escHtml', 'monthsSlug', 'stat', 'buildFinalOutputs', 'buildSaidaOutputs', 'validExt',
];

/** Recorta de wireStep2 as linhas que comparam os meses do cartão com os das vendas. */
function trechoCompararMeses(src: string): string {
  const ini = src.indexOf('var cardKeys = {};');
  const fim = src.indexOf('function proceedWith', ini);
  if (ini < 0 || fim < 0) throw new Error('não achei a comparação de meses do wireStep2');
  const excl = /state\.excludedMonths = reconcileMonths\s*\?\s*(cardMonths\.filter\(function\(m\)\{[^}]*\}\))\s*:\s*\[\]/.exec(src);
  if (!excl) throw new Error('não achei o excludedMonths do wireStep2');
  return 'function __compararMeses(cardMonths, salesMonths){\n' + src.slice(ini, fim) +
    '\nreturn { extras: extraSalesMonths, comuns: intersectionMonths, excluidos: ' + excl[1] + ' };\n}';
}

const caches: Partial<Record<'puro' | 'corrigido', Legado>> = {};

/**
 * O original recortado. `corrigido` = com a leitura de datas e números corrigida no nads
 * (aprovado pelo Vitor em 2026-09-28) no lugar de parseDateFlexible/parseNumberFlexible, para o
 * resto (conciliação, totais, arquivos) continuar sendo comparado com o original.
 */
export function carregarLegado(corrigido = false): Legado {
  const modo = corrigido ? 'corrigido' : 'puro';
  const pronto = caches[modo];
  if (pronto) return pronto;
  const html = fonteLegado();
  const XLSX = new Function('var module, exports, define, require;\n' + codigoSheetJs(html) + '\n;return XLSX;')();
  const src = codigoProprio(html);
  const corpo = [
    '"use strict";',
    'var state = null;',
    'var __els = {};',
    'var document = { getElementById: function(id){ return __els[id] || (__els[id] = { style: {} }); } };',
    'var finalOutputs = {}, finalSaidaOutputs = {};',
    // pedaços de tela que as funções chamam: aqui não desenham nada
    'function svg(){ return ""; }',
    'function renderBrandTabs(){} function renderPreviewForBrand(){} function renderBrandDownloads(){} function renderSaidaDownloads(){}',
    ...VARS.map(v => extrairVar(src, v)),
    ...FUNCOES.map(f => extrairFuncao(src, f)),
    corrigido ? 'parseDateFlexible = __corr.data; parseNumberFlexible = __corr.numero;' : '',
    trechoCompararMeses(src),
    'return { XLSX: XLSX, BRAND_META: BRAND_META, BRAND_LIST: BRAND_LIST,' +
      ' usarEstado: function(s){ state = s; __els = {}; finalOutputs = {}; finalSaidaOutputs = {}; },' +
      ' elemento: function(id){ return __els[id] || {}; },' +
      ' finalOutputs: function(){ return finalOutputs; }, finalSaidaOutputs: function(){ return finalSaidaOutputs; },' +
      ' compararMeses: __compararMeses, ' +
      FUNCOES.map(f => f + ': ' + f).join(', ') + ' };',
  ].join('\n');
  const l = new Function('XLSX', '__corr', corpo)(XLSX, { data: lerDataFlexivel, numero: lerNumeroFlexivel }) as Legado;
  caches[modo] = l;
  return l;
}
