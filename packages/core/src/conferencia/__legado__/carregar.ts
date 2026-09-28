/// <reference types="node" />
// Só para os testes de paridade: lê o conferencia.html original do disco, recorta
// algumas funções pelo nome e roda SÓ elas num sandbox (new Function). Nunca roda o
// script inteiro (ele mexe em document e no banco). Nada aqui vai para o app.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Conta, Empresa, GrupoNatureza, Nota, NotaComTipo, NotaServico, TipoCfop } from '../tipos';

/** nads e contabil-htmls são irmãos dentro de CLAUDE_DRIVE. */
export const CAMINHO_LEGADO = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../../contabil-htmls/conferencia.html');

export function temLegado(): boolean {
  return existsSync(CAMINHO_LEGADO);
}

let fonteCache: string | null = null;
export function fonteLegado(): string {
  if (fonteCache == null) fonteCache = readFileSync(CAMINHO_LEGADO, 'utf8');
  return fonteCache;
}

// ---------- recorte ----------
const ANTES_DE_REGEX = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);

/**
 * Anda pelo código a partir de `i` e devolve onde termina o trecho: no fechamento da chave
 * (modo 'bloco', começando em "{") ou no ";"/quebra de linha no nível zero (modo 'expressao').
 * Pula strings, comentários e regex.
 */
function varrer(src: string, i: number, modo: 'bloco' | 'expressao'): number {
  let prof = 0;
  let ultimo = '='; // último caractere significativo (decide se "/" é regex)
  let palavra = '';
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const prox = src[i + 1];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < n && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
      i = j + 1; ultimo = ch; palavra = ''; continue;
    }
    if (ch === '/' && prox === '/') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; continue; }
    if (ch === '/' && prox === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue; }
    if (ch === '/') {
      const ehRegex = ANTES_DE_REGEX.has(ultimo) || palavra === 'return' || palavra === 'typeof';
      if (ehRegex) {
        let j = i + 1;
        let classe = false;
        while (j < n) {
          const c = src[j];
          if (c === '\\') { j += 2; continue; }
          if (c === '[') classe = true; else if (c === ']') classe = false;
          else if (c === '/' && !classe) break;
          j++;
        }
        j++;
        while (j < n && /[a-z]/i.test(src[j])) j++;
        i = j; ultimo = ')'; palavra = ''; continue;
      }
    }
    if (ch === '{' || ch === '(' || ch === '[') prof++;
    else if (ch === '}' || ch === ')' || ch === ']') {
      prof--;
      if (modo === 'bloco' && prof === 0 && ch === '}') return i + 1;
    } else if (modo === 'expressao' && prof === 0 && (ch === ';' || ch === '\n') && ultimo !== '=') return i;
    if (!/\s/.test(ch)) {
      ultimo = ch;
      palavra = /[\w$]/.test(ch) ? palavra + ch : '';
    } else palavra = '';
    i++;
  }
  throw new Error('fim do arquivo sem fechar o trecho');
}

/** Código de `function nome(...){...}` (a declaração precisa ser única no arquivo). */
export function extrairFuncao(src: string, nome: string): string {
  const re = new RegExp('(^|[^\\w$.])function\\s+' + nome.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
  const achados = [...src.matchAll(re)];
  if (achados.length !== 1) throw new Error('function ' + nome + ': ' + achados.length + ' declarações no legado');
  const m = achados[0];
  const ini = (m.index as number) + m[1].length;
  const abre = src.indexOf('{', src.indexOf(')', ini));
  return src.slice(ini, varrer(src, abre, 'bloco'));
}

/** Código de `var nome=...;` (a declaração precisa ser única no arquivo). */
export function extrairVar(src: string, nome: string): string {
  const re = new RegExp('(^|[^\\w$.])var\\s+' + nome + '\\s*=', 'g');
  const achados = [...src.matchAll(re)];
  if (achados.length !== 1) throw new Error('var ' + nome + ': ' + achados.length + ' declarações no legado');
  const m = achados[0];
  const ini = (m.index as number) + m[1].length;
  const depoisIgual = ini + m[0].length - m[1].length;
  return src.slice(ini, varrer(src, depoisIgual, 'expressao')) + ';';
}

// ---------- o sandbox ----------
type ParteHistorico = { nota: string; doc: string; nome: string; contra: string; lanc: string };
export interface DivergenciaLegado { nota: Nota; chave: string; padrao: string; origem?: string; cadastrado?: boolean; qtdPadrao?: number; totalCfop?: number }

/** As funções do original, com a mesma assinatura que tinham lá (as que leem emp() usam usarEmpresa). */
export interface Legado {
  usarEmpresa(e: Empresa): void;
  CFOP_DESC: Record<string, string>;
  DESC_AMBOS: Record<string, number>;
  num(v: unknown): number | null;
  comp(dt: string): string;
  lancN(l: unknown): string;
  docLimpo(d: unknown): string;
  nomeNorm(s: unknown): string;
  tipoDoCfop(c: string): TipoCfop | null;
  chave(n: Nota): string;
  chaveNaturezaNota(n: Partial<NotaComTipo>, tipoPadrao?: TipoCfop): string;
  agruparTotaisPorNatureza(notas: NotaComTipo[]): Record<string, GrupoNatureza>;
  ehCfopVenda(n: Partial<Nota>): boolean;
  ehVendaVista(n: Partial<Nota>): boolean;
  padraoPorCfop(tipo: 'entradas' | 'saidas'): Record<string, { lanc: string; qtd: number; total: number }>;
  acharDivergencias(tipo: 'entradas' | 'saidas'): DivergenciaLegado[];
  gruposConciliacao(chaves: string[]): { naturezas: string[]; contas: string[] }[];
  nomeBaseConta(nome: string): string;
  nomeComumContas(nomes: string[]): string | null;
  lerNotas(rows: string[][]): Nota[];
  lerBalancete(rows: string[][]): Record<string, Conta>;
  lerServicos(rows: string[][], tipo: 'tomados' | 'prestados'): { notas: NotaServico[]; canceladas: number };
  vcLerRazao(rows: string[][]): Promise<{ txt: string; data: string; valor: number; sinal: number; contra: string }[]>;
  vcNumerosDoHistorico(txt: string, serv: boolean): string[];
  vcPartesHistorico(txt: string): ParteHistorico;
  ehLinhaIcms(l: { txt: string }): boolean;
  melhorConta(natureza: string, contas: Conta[]): Conta | null;
  assinaturaBalancete(lista: Conta[]): Record<string, string>;
  verificarBalancete(lista: Conta[]): { problemas: string[]; similaridade: number | null };
}

const VARS_ANTES = ['CFOP_DESC', 'STOPWORDS_CONTA', 'esc', 'BAL_SIMILARIDADE_MIN'];
const FUNCOES = [
  'num', 'comp', 'lancN', 'docLimpo', 'nomeNorm', 'normalizarTexto', 'palavrasSignificativas', 'melhorConta',
  'tipoDoCfop', 'chave', 'chaveNaturezaNota', 'agruparTotaisPorNatureza',
  'ehCfopVenda', 'ehVendaVista', 'ctxVista', 'lancEsperadoSaida', 'lancVistaDaNota', 'padraoPorCfop', 'acharDivergencias',
  'contasDaNatureza', 'gruposConciliacao', 'nomeBaseConta', 'nomeBaseNormalizada', 'nomeComumContas',
  'acha', 'col', 'normExportado', 'lerNotas', 'classificarGrupo', 'lerBalancete', 'lerServicos', 'vcLerRazao',
  'vcNumerosDoHistorico', 'vcPartesHistorico', 'ehLinhaIcms', 'assinaturaBalancete', 'verificarBalancete',
];
const VARS_DEPOIS = ['DESC_AMBOS'];

let legadoCache: Legado | null = null;

export function carregarLegado(): Legado {
  if (legadoCache) return legadoCache;
  const src = fonteLegado();
  const corpo = [
    '"use strict";',
    'var __emp = null;',
    'function emp(){ return __emp; }',
    // o original lê o arquivo com sheet(file) → Promise das linhas; aqui as linhas já vêm prontas
    'function sheet(rows){ return Promise.resolve(rows); }',
    ...VARS_ANTES.map(v => extrairVar(src, v)),
    ...FUNCOES.map(f => extrairFuncao(src, f)),
    ...VARS_DEPOIS.map(v => extrairVar(src, v)),
    'return { usarEmpresa: function(e){ __emp = e; }, CFOP_DESC: CFOP_DESC, DESC_AMBOS: DESC_AMBOS, ' +
      FUNCOES.map(f => f + ': ' + f).join(', ') + ' };',
  ].join('\n');
  legadoCache = new Function(corpo)() as Legado;
  return legadoCache;
}
