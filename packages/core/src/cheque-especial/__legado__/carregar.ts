/// <reference types="node" />
// Só para os testes de paridade: lê o cheque_especial.html original do disco, recorta as
// funções de regra pelo nome e roda SÓ elas num sandbox (new Function), com o módulo 'xlsx'
// no lugar do SheetJS colado e um `state = { invertCD }` controlável. Nunca roda o script
// inteiro (ele mexe em document). Nada aqui vai para o app.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { extrairFuncao, extrairVar } from '../../conferencia/__legado__/carregar';
import { serialExcelParaData } from '../regras/datas';
import { saldoDaCelula } from '../regras/saldo';

/** nads e contabil-htmls são irmãos dentro de CLAUDE_DRIVE. */
export const CAMINHO_LEGADO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../contabil-htmls/cheque_especial.html');

export function temLegado(): boolean {
  return existsSync(CAMINHO_LEGADO);
}

let fonteCache: string | null = null;
export function fonteLegado(): string {
  if (fonteCache == null) fonteCache = readFileSync(CAMINHO_LEGADO, 'utf8');
  return fonteCache;
}

export interface DiaLegado { date: Date; saldo: number }
export interface LancamentoLegado {
  data: Date; debito: string; credito: string; valor: number; historico: string;
  tipo: string; obs: string; projetado: boolean;
}

/** As funções do original, com a mesma assinatura que tinham lá. */
export interface Legado {
  /** Liga/desliga a convenção invertida (o checkbox fInvertCD). */
  usarInvertCD(v: boolean): void;
  /** O innerHTML que renderResults escreveu por último. */
  htmlResultado(): string;
  VALID_EXTS: string[];
  BLANK_LEAD_ROWS: number;
  validExt(nome: string): boolean;
  readSheet(file: { arrayBuffer(): Promise<ArrayBuffer> }): Promise<{ ok: boolean; rows?: unknown[][]; reason?: string }>;
  normalizeHeader(s: unknown): string;
  findColumns(rows: unknown[][]): { headerRow: number; dataCol: number; saldoCol: number } | null;
  excelSerialToDate(n: number): Date;
  parseDateCell(v: unknown): Date | null;
  dateOnly(d: Date): Date;
  roundCents(n: number): number;
  parseSaldoCell(v: unknown): number | null;
  isBusinessDay(d: Date): boolean;
  nextBusinessDay(d: Date): Date;
  fmtDateBR(d: Date): string;
  fmtMoney(n: number): string;
  buildDailyClosingBalances(rows: unknown[][], cols: { headerRow: number; dataCol: number; saldoCol: number }): DiaLegado[];
  buildLancamentos(days: DiaLegado[], banco: string, cheque: string, hist: string): { lancamentos: LancamentoLegado[]; trailing: boolean };
  renderResults(result: { lancamentos: LancamentoLegado[]; trailing: boolean }, days: DiaLegado[], banco: string, cheque: string, hist: string): void;
  dateToExcelSerial(d: Date): number;
  buildLancamentosSheet(l: LancamentoLegado[]): XLSX.WorkBook;
}

const VARS = ['VALID_EXTS', 'MS_DAY', 'BLANK_LEAD_ROWS'];
const FUNCOES = [
  'validExt', 'escapeHtml', 'readSheet', 'normalizeHeader', 'findColumns', 'excelSerialToDate', 'parseDateCell',
  'dateOnly', 'roundCents', 'parseSaldoCell', 'isBusinessDay', 'nextBusinessDay', 'fmtDateBR', 'fmtMoney',
  'buildDailyClosingBalances', 'buildLancamentos', 'renderResults', 'dateToExcelSerial', 'buildLancamentosSheet',
];

const caches: Partial<Record<'puro' | 'corrigido', Legado>> = {};

/**
 * O original recortado. `corrigido` = o original com as correções aprovadas pelo Vitor em
 * 2026-09-28 no lugar das funções defeituosas (excelSerialToDate e parseSaldoCell), para que
 * o resto (agrupar por dia, lançamentos, planilha) continue sendo comparado com o original.
 */
export function carregarLegado(corrigido = false): Legado {
  const modo = corrigido ? 'corrigido' : 'puro';
  const pronto = caches[modo];
  if (pronto) return pronto;
  const src = fonteLegado();
  const corpo = [
    '"use strict";',
    'var state = { file:null, rows:null, parsing:false, invertCD:true };',
    // o que renderResults toca na tela: só guardamos o HTML e ignoramos os botões
    "var ICONS = { alert:'', download:'' };",
    "var resultsHost = { innerHTML:'' };",
    'var document = { getElementById: function(){ return { addEventListener: function(){} }; } };',
    'function downloadLancamentos(){}',
    ...VARS.map(v => extrairVar(src, v)),
    ...FUNCOES.map(f => extrairFuncao(src, f)),
    corrigido ? 'excelSerialToDate = __corr.serial; parseSaldoCell = function(v){ return __corr.saldo(v, state.invertCD); };' : '',
    'return { usarInvertCD: function(v){ state.invertCD = v; }, htmlResultado: function(){ return resultsHost.innerHTML; }, ' +
      VARS.map(v => v + ': ' + v).join(', ') + ', ' + FUNCOES.map(f => f + ': ' + f).join(', ') + ' };',
  ].join('\n');
  const corr = { serial: serialExcelParaData, saldo: saldoDaCelula };
  const l = new Function('XLSX', '__corr', corpo)(XLSX, corr) as Legado;
  caches[modo] = l;
  return l;
}
