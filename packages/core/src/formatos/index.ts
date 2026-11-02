// Formatos compartilhados por todos os sistemas (texto, número, data, CSV).
// Origem: helpers da Conferência (conferencia.html ~L1451-1478, 1546, 2576, 2659, 2791-2797).
// Regra de ouro: mesma entrada, mesma saída — nada aqui olha a tela ou o banco.

export const MES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 1234.5 → "R$ 1.234,50" (com o espaço que não quebra; negativo com o − na frente): todo valor em dinheiro na tela (Vitor, 05/10/2026) */
/** um formatador só para o app todo (19/10/2026: montar um a cada valor pesava nas tabelas de milhares de linhas) */
export const DUAS_CASAS = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function reais(n: number): string {
  return (n < 0 ? '\u2212' : '') + 'R$\u00a0' + brl(Math.abs(n));
}

/** 1234.5 → "1.234,50" */
export function brl(n: number): string {
  return DUAS_CASAS.format(n);
}

/** Lê número de planilha em formato brasileiro: "1.234,56", "(1.234,56)", "1.234,56 D". */
export function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).trim().replace(/\s*[DC]$/, '').trim();
  if (!/[0-9]/.test(s) || !/^-?\(?[\d.,]+\)?$/.test(s)) return null;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()]/g, '');
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : neg ? -n : n;
}

/** "05/03/2026" → "2026-03" (competência). */
export function comp(dt: string | null | undefined): string {
  const m = String(dt || '').match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!m) return '';
  let a = m[3];
  if (a.length === 2) a = '20' + a;
  return a + '-' + m[2].padStart(2, '0');
}

/** "05/03/2026" → 20260305 (para ordenar e comparar). 0 quando não é data. */
export function dataOrdem(dt: string | null | undefined): number {
  const m = String(dt || '').match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!m) return 0;
  let a = m[3];
  if (a.length === 2) a = '20' + a;
  return +a * 10000 + +m[2] * 100 + +m[1];
}

/** "2026-03" → "março de 2026" */
export function rot(c: string): string {
  const p = c.split('-');
  return MES[+p[1]] + ' de ' + p[0];
}

/** "2026-03" → "mar/26" */
export function mesCurto(c: string): string {
  const p = String(c).split('-');
  return (MES[+p[1]] || '').slice(0, 3) + '/' + (p[0] || '').slice(2);
}

/** Para comparar nomes: sem acento, minúsculo, só letras/números separados por espaço. */
export function nomeNorm(s: unknown): string {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizarTexto(s: unknown): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function slug(nome: string): string {
  return String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '') || 'empresa';
}

export function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Lançamento sem zeros à esquerda e sem ".0" do Excel: "00182" → "182". */
export function lancN(l: unknown): string {
  return String(l == null ? '' : l).trim().replace(/\.0$/, '').replace(/^0+(?=\d)/, '');
}

/** Mostra o código cadastrado ("182") com os zeros do lançamento da nota ("00182"). */
export function lancComZeros(l: unknown, modelo: unknown): string {
  const s = String(l == null ? '' : l);
  const m = String(modelo == null ? '' : modelo);
  const t = m.length;
  return /^\d+$/.test(s) && t > s.length && /^0/.test(m) ? (new Array(t + 1).join('0') + s).slice(-t) : s;
}

/** CPF/CNPJ só com letras e números; "000" vira vazio. */
export function docLimpo(doc: unknown): string {
  const d = String(doc || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return /^0*$/.test(d) ? '' : d;
}

export function ehCpf(doc: unknown): boolean {
  return /^\d{11}$/.test(docLimpo(doc));
}

/** "Exportado" vem "Sim"/"Não" (notas) ou "S"/"N" (serviços): padroniza pros dois. */
export function normExportado(v: unknown): '' | 'Sim' | 'Não' {
  const s = nomeNorm(v);
  if (s === 'sim' || s === 's') return 'Sim';
  if (s === 'nao' || s === 'n') return 'Não';
  return '';
}

/** Compara códigos numéricos como a Conferência ("2" antes de "10"). */
export function compararNumerico(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** CSV do escritório: separador ";", BOM para o Excel abrir com acento. */
export function montarCsv(linhas: string[]): string {
  return '﻿' + linhas.join('\n');
}

/** Máscara dd/mm/aaaa enquanto digita. */
export function mascaraData(v: string): string {
  let s = v.replace(/\D/g, '').slice(0, 8);
  if (s.length > 4) s = s.slice(0, 2) + '/' + s.slice(2, 4) + '/' + s.slice(4);
  else if (s.length > 2) s = s.slice(0, 2) + '/' + s.slice(2);
  return s;
}

/**
 * Máscara do CNPJ ou do CPF enquanto digita (Sávio, 20/10/2026: cadastrar o CNPJ/CPF nas Configurações do DP): até 11
 * números, 000.000.000-00; de 12 a 14, 00.000.000/0000-00.
 */
export function mascaraDocumento(v: string): string {
  const s = v.replace(/\D/g, '').slice(0, 14);
  if (s.length <= 11) {
    return s.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
  }
  return s.slice(0, 2) + '.' + s.slice(2, 5) + '.' + s.slice(5, 8) + '/' + s.slice(8, 12) + (s.length > 12 ? '-' + s.slice(12) : '');
}

/** "28/09/2026 às 10:22" */
export function dataHora(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * O valor que a pessoa digitou num campo de reais (o mesmo do campo de valor do Relatório do Fiscal): "1.234,56", "1234,5",
 * "R$ 10" e o ponto sozinho com uma ou duas casas como decimal ("1234.56" → 1234,56; 30/10/2026: o total da folha virava
 * 123456). null quando não é número.
 */
export function numeroDigitado(texto: string): number | null {
  const s = String(texto ?? '').trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return null;
  const n = /^-?\d+\.\d{1,2}$/.test(s) ? Number(s) : Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const DIA_EM_BRASILIA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
/**
 * O dia ('AAAA-MM-DD') no horário de Brasília, de agora ou de um instante ISO (30/10/2026: cortar o ISO, que é UTC, dava o
 * dia seguinte depois das 21h). A data sem hora ('2026-09-15') já é o dia e fica como está. '' para o que não é data.
 */
export function diaEmBrasilia(quando: Date | string = new Date()): string {
  if (typeof quando === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(quando.trim())) return quando.trim();
  const d = typeof quando === 'string' ? new Date(quando) : quando;
  if (isNaN(d.getTime())) return '';
  const p = Object.fromEntries(DIA_EM_BRASILIA.formatToParts(d).map(x => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day;
}
