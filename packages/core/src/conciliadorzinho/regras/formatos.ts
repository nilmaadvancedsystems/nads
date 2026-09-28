// Formatos do Conciliadorzinho: mês, dinheiro, data e leitura "flexível" das células.
// Origem: conciliadorZINHO.html helpers (~L816-869): MONTHS, monthLabel, fmtBR, fmtBRL, pad2,
// fmtDate, csvField, excelSerialToDate, parseDateFlexible, parseNumberFlexible;
// cleanHistorico (~L906) e extractNfFromHistorico (~L916).
import { brl as numeroBR } from '../../formatos';
import type { Mes } from '../tipos';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** { mes: 7, ano: 2026 } → 'Julho/2026' (monthLabel). */
export function rotuloMes(m: Mes): string {
  return MESES[m.mes - 1] + '/' + m.ano;
}

/** 1234.5 → '1.234,50' (fmtBR). */
export const valorBR = numeroBR;

/** Espaço que não quebra (U+00A0): é o que o original põe entre 'R$' e o número. */
const ESPACO_FIXO = String.fromCharCode(0xa0);

/** 1234.5 → 'R$ 1.234,50' com espaço que não quebra depois do 'R$' (fmtBRL). */
export function brl(n: number): string {
  return 'R$' + ESPACO_FIXO + valorBR(n);
}

export function pad2(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

/** Date → 'dd/mm/aaaa' pela hora local (fmtDate). */
export function chaveDaData(d: Date): string {
  return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();
}

/** Campo de CSV com ';': aspas só quando tem ';', '"' ou quebra de linha (csvField). */
export function campoCsv(v: unknown): string {
  const s = String(v == null ? '' : v);
  if (/[;"\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Número de série do Excel (época 1899-12-30) → data local à meia-noite (excelSerialToDate). */
export function dataDoSerialExcel(n: number): Date {
  const diasUtc = Math.floor(n) - 25569;
  const d = new Date(diasUtc * 86400 * 1000);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Data de uma célula (parseDateFlexible): Date, série do Excel entre 20000 e 80000,
 * texto 'd/m/aa(aa)' (também com '-' ou '.') ou 'aaaa-mm-dd'. Senão null.
 */
export function lerDataFlexivel(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  if (typeof v === 'number' && isFinite(v) && v > 20000 && v < 80000) return dataDoSerialExcel(v);
  if (typeof v === 'string') {
    const s = v.trim();
    let m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (m) {
      const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10);
      let ano = parseInt(m[3], 10);
      if (ano < 100) ano += 2000;
      const d = new Date(ano, mes - 1, dia);
      // corrigido no nads: '31/02/2026' não "rola" para 03/03 (o original aceitava); data que não existe é ignorada
      if (d.getMonth() === mes - 1 && d.getDate() === dia) return d;
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }
  return null;
}

/**
 * Número de uma célula (parseNumberFlexible): número finito, ou texto com 'R$', espaços,
 * sinal '-' ou parênteses. Com vírgula e ponto, o que vem por último é o decimal; só vírgula:
 * vírgula decimal; só ponto: "1.000"/"1.234.567" são milhar, senão ("12.5") é decimal.
 * Corrigido no nads: o original lia "1.000" como 1, "12,345" como 12345 e "1.234,567" como 1,23.
 */
export function lerNumeroFlexivel(v: unknown): number | null {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return null;
  const neg = /^-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/^\((.*)\)$/, '$1').replace(/^-/, '');
  const virg = s.lastIndexOf(',');
  const ponto = s.lastIndexOf('.');
  if (virg >= 0 && ponto >= 0) s = virg > ponto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (virg >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

/**
 * Histórico da venda sem o texto padrão da frente (cleanHistorico):
 * 'Pelas vendas ... NF-e nº 200294-0-CONSUMIDOR FINAL' → '200294-0-CONSUMIDOR FINAL'.
 */
export function limparHistorico(bruto: unknown): string {
  const s = String(bruto == null ? '' : bruto).trim();
  if (!s) return '';
  const m = s.match(/(\d+\s*-\s*\d+\s*-\s*.+)$/);
  return (m ? m[1] : s).replace(/\s*-\s*/g, '-').trim();
}

/** A NF é o primeiro trecho antes do '-' do histórico limpo (extractNfFromHistorico). */
export function notaDoHistorico(limpo: unknown): string {
  const s = String(limpo == null ? '' : limpo).trim();
  if (!s) return '';
  const i = s.indexOf('-');
  return i === -1 ? s : s.slice(0, i).trim();
}
