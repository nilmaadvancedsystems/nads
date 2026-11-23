// A entrada do intermediário nads → SCI: a planilha de importação que as telas do nads já baixam (o .xls de 10 colunas
// do Alterdata: (vazia) · Débito · Crédito · Data · Valor · Cód. histórico · Complemento · (vazia) · (vazia) · Nota) e a
// planilha de de/para das contas que o escritório guarda no Drive (Conta no nads · Conta no SCI · Nome).
import * as XLSX from 'xlsx';
import type { ContaNoSci, DeParaDasContas, LinhaDoNads } from '../tipos';

type Celula = string | number | boolean | Date | null | undefined;

function linhasDaPrimeiraAba(bytes: Uint8Array): Celula[][] {
  const wb = XLSX.read(bytes, { type: 'array', raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Celula[]>(ws, { header: 1, raw: true, defval: '' });
}

const texto = (v: Celula) => (v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim());

/** O código de uma conta ou histórico: o número sem o ".0" que o Excel às vezes põe. */
export function codigo(v: Celula): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return texto(v).replace(/\.0+$/, '');
}

/** A data da planilha em aaaa-mm-dd: data do Excel (número), Date ou texto dd/mm/aaaa (ou aaaa-mm-dd). '' se não for data. */
export function dataIso(v: Celula): string {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return '';
    return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  }
  const s = texto(v);
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

/** O valor em centavos: número do Excel ou texto "1.500,00" / "1500.00". NaN se não for número. */
export function centavos(v: Celula): number {
  if (typeof v === 'number') return Math.round(v * 100);
  let s = texto(v).replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return isFinite(n) ? Math.round(n * 100) : NaN;
}

/**
 * As linhas da planilha de importação do nads. Pula as linhas vazias (as 4 do começo) e as que não têm conta nenhuma
 * nem valor; o resto entra como veio (o que estiver errado aparece nos problemas do lançamento).
 */
export function lerPlanilhaDoNads(bytes: Uint8Array, origem: string): LinhaDoNads[] {
  const out: LinhaDoNads[] = [];
  for (const r of linhasDaPrimeiraAba(bytes)) {
    const debito = codigo(r[1]);
    const credito = codigo(r[2]);
    const valorBruto = texto(r[4]);
    if (!debito && !credito && !valorBruto) continue;
    const valor = centavos(r[4]);
    out.push({
      data: dataIso(r[3]), debito, credito, valor: isNaN(valor) ? NaN : Math.abs(valor),
      codHistorico: codigo(r[5]), complemento: texto(r[6]), documento: codigo(r[9]), origem,
    });
  }
  return out;
}

/**
 * A planilha de de/para do escritório: na 1ª coluna a conta do nads (o reduzido do Alterdata), na 2ª a conta do SCI e,
 * se tiver, o nome na 3ª. A linha de títulos (sem número na 1ª coluna) é pulada; a mesma conta repetida vale a última.
 */
export function lerDePara(bytes: Uint8Array): Map<string, ContaNoSci> {
  const mapa = new Map<string, ContaNoSci>();
  for (const r of linhasDaPrimeiraAba(bytes)) {
    const de = codigo(r[0]);
    const para = codigo(r[1]);
    if (!de || !para || !/\d/.test(de)) continue;
    mapa.set(de, { codigo: para, nome: texto(r[2]) });
  }
  return mapa;
}

/** O de/para vazio (as contas vão como vieram). */
export const SEM_DE_PARA: DeParaDasContas = new Map();
