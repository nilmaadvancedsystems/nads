// Datas do Cheque especial.
// Origem: cheque_especial.html — MS_DAY/excelSerialToDate (~L539), parseDateCell (~L547),
// dateOnly (~L563), isBusinessDay/nextBusinessDay (~L593), fmtDateBR (~L602),
// dateToExcelSerial (~L752).

export const MS_DIA = 86400000;

/**
 * Serial do Excel → data local à meia-noite (época 1899-12-30, a mesma do SheetJS/Windows).
 * CORRIGIDO no nads: o original fazia meia-noite UTC e cortava no fuso local, e no Brasil
 * (UTC-3) a data caía no DIA ANTERIOR. Agora o dia é o do serial, em qualquer fuso.
 */
export function serialExcelParaData(n: number): Date {
  const diasUtc = Math.floor(n) - 25569;
  const utc = new Date(diasUtc * MS_DIA);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

/** Só a data (meia-noite no fuso local). */
export function soData(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Valor da célula da coluna Data → data (ou null).
 * Aceita Date, serial numérico e texto "dd/mm/aa(aa)…"; texto numérico > 1000 vira serial.
 */
export function dataDaCelula(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return soData(v);
  if (typeof v === 'number') return soData(serialExcelParaData(v));
  if (typeof v === 'string') {
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10);
      let a = parseInt(m[3], 10);
      if (a < 100) a += 2000;
      return soData(new Date(a, mes - 1, d));
    }
    const n = Number(v.replace(',', '.'));
    if (!isNaN(n) && n > 1000) return soData(serialExcelParaData(n));
  }
  return null;
}

/** Segunda a sexta (não olha feriado). */
export function diaUtil(d: Date): boolean {
  const dia = d.getDay();
  return dia !== 0 && dia !== 6;
}

/** O primeiro dia útil depois de `d`. */
export function proximoDiaUtil(d: Date): Date {
  let prox = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  while (!diaUtil(prox)) prox = new Date(prox.getFullYear(), prox.getMonth(), prox.getDate() + 1);
  return prox;
}

/** dd/mm/aaaa */
export function dataBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + d.getFullYear();
}

/**
 * Date → serial do Excel, calculado à mão pela data local (o original não deixa o SheetJS
 * converter o Date porque ele usa UTC e pode deslocar ±1 dia conforme o fuso).
 */
export function dataParaSerialExcel(d: Date): number {
  const msUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round(msUtc / MS_DIA) + 25569;
}
