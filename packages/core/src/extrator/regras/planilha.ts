// Planilha (razão da conta do banco, relatório de lançamentos ou extrato em Excel/CSV) → lançamentos.
// Acha o cabeçalho pelas palavras (Data, Histórico, Valor ou Débito/Crédito, D/C); sem cabeçalho,
// adivinha pelas colunas (a que mais tem data, a de valores e a de texto mais longo).
// Origem: protótipo do Extrator (leitura.js: lerPlanilha).
import { normalizarTexto } from '../../formatos';
import type { Lado, Lancamento } from '../tipos';
import { centavos, lerData } from './texto';

export type Celula = unknown;

interface Colunas { data?: number; hist?: number; valor?: number; deb?: number; cred?: number; dc?: number; contaD?: number; contaC?: number }

function achaCabecalho(linha: Celula[]): Colunas {
  const c: Colunas = {};
  linha.forEach((v, i) => {
    const n = normalizarTexto(v);
    if (!n) return;
    if (c.data == null && /^(data|dt|data lanc\w*|data do lanc\w*|data mov\w*|dia)$/.test(n)) c.data = i;
    else if (/conta/.test(n) && /deb/.test(n)) c.contaD = i;
    else if (/conta/.test(n) && /cred/.test(n)) c.contaC = i;
    else if (c.hist == null && /(hist|descri|complement|lancamento$|^observ)/.test(n)) c.hist = i;
    else if (c.deb == null && /^(debito|debitos|vlr debito|valor debito|saida|saidas)$/.test(n)) c.deb = i;
    else if (c.cred == null && /^(credito|creditos|vlr credito|valor credito|entrada|entradas)$/.test(n)) c.cred = i;
    else if (c.valor == null && /^(valor|vlr|valor r|valor rs|montante|quantia|valor do lancamento)$/.test(n)) c.valor = i;
    else if (c.dc == null && /^(d c|dc|natureza|nat|tipo|deb cred|c d)$/.test(n)) c.dc = i;
  });
  return c;
}

function adivinhar(linhas: Celula[][], ano: number): Colunas | null {
  let n = 0;
  for (const l of linhas) if (l.length > n) n = l.length;
  const sc = Array.from({ length: n }, () => ({ d: 0, v: 0, t: 0 }));
  for (const l of linhas.slice(0, 300)) {
    l.forEach((v, k) => {
      if (lerData(v, ano)) sc[k].d++;
      else if (centavos(v) != null) sc[k].v++;
      else if (String(v ?? '').trim().length > 3) sc[k].t += String(v).length;
    });
  }
  const c: Colunas = {};
  let md = 0, mt = 0;
  sc.forEach((s, k) => { if (s.d > md) { md = s.d; c.data = k; } if (s.t > mt) { mt = s.t; c.hist = k; } });
  sc.forEach((s, k) => { if (k !== c.data && s.v > 0 && c.valor == null && s.v >= md * 0.6) c.valor = k; });
  return c.data == null || c.valor == null ? null : c;
}

const texto = (v: Celula) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

/**
 * Linhas da planilha → lançamentos, no sinal do banco (+ entrou, − saiu).
 * No sistema, débito na conta do banco é entrada; no extrato, débito é saída.
 * Com colunas Conta Débito / Conta Crédito e um Valor só, a conta que aparece em mais linhas é a do
 * banco: débito nela = entrada.
 */
export function lancamentosDaPlanilha(linhas: Celula[][], lado: Lado, anoPadrao = new Date().getFullYear()): { lancamentos: Lancamento[]; erro: string | null } {
  let inicio = 0;
  let cols: Colunas | null = null;
  for (let i = 0; i < Math.min(linhas.length, 40); i++) {
    const c = achaCabecalho(linhas[i] || []);
    if (c.data != null && (c.valor != null || c.deb != null || c.cred != null)) { inicio = i + 1; cols = c; break; }
  }
  if (!cols) cols = adivinhar(linhas, anoPadrao);
  if (!cols) return { lancamentos: [], erro: 'Não achei as colunas de data e valor.' };
  const k = cols;

  let contaBanco: string | null = null;
  if (k.contaD != null && k.contaC != null) {
    const conta: Record<string, number> = {};
    for (const l of linhas.slice(inicio)) for (const v of [texto(l[k.contaD]), texto(l[k.contaC])]) if (v) conta[v] = (conta[v] || 0) + 1;
    for (const c of Object.keys(conta)) if (!contaBanco || conta[c] > conta[contaBanco]) contaBanco = c;
  }

  const saida: Lancamento[] = [];
  let ultimo: Lancamento | null = null;
  for (const l of linhas.slice(inicio)) {
    const data = k.data != null ? lerData(l[k.data], anoPadrao) : null;
    const hist = k.hist != null ? texto(l[k.hist]) : '';
    if (!data) {
      // linha de continuação do histórico
      const semValor = [k.valor, k.deb, k.cred].every(c => c == null || centavos(l[c]) == null);
      if (ultimo && hist && semValor) ultimo.historico = (ultimo.historico + ' ' + hist).trim();
      continue;
    }
    if (/saldo anterior|saldo inicial|saldo final|^total/.test(normalizarTexto(hist))) continue;
    let c: number | null = null;
    if (k.deb != null || k.cred != null) {
      const db = k.deb != null ? Math.abs(centavos(l[k.deb]) || 0) : 0;
      const cr = k.cred != null ? Math.abs(centavos(l[k.cred]) || 0) : 0;
      if (db || cr) c = lado === 'sistema' ? db - cr : cr - db;
    }
    if (c == null && k.valor != null) {
      c = centavos(l[k.valor]);
      if (c != null && k.dc != null) {
        const dc = normalizarTexto(l[k.dc]).charAt(0);
        if (dc === 'd') c = lado === 'sistema' ? Math.abs(c) : -Math.abs(c);
        else if (dc === 'c') c = lado === 'sistema' ? -Math.abs(c) : Math.abs(c);
      } else if (c != null && contaBanco && k.contaD != null && k.contaC != null) {
        if (texto(l[k.contaD]) === contaBanco) c = Math.abs(c);
        else if (texto(l[k.contaC]) === contaBanco) c = -Math.abs(c);
      }
    }
    if (c == null || c === 0) continue;
    ultimo = { data, valor: c, historico: hist || '(sem histórico)' };
    saida.push(ultimo);
  }
  return { lancamentos: saida, erro: saida.length ? null : 'Não achei lançamentos com data e valor.' };
}
