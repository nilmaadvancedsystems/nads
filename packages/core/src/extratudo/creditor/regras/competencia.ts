// A competência (mês/ano) da conciliação: o primeiro passo do Creditor. Com ela, o relatório de
// liquidação é buscado na pasta da empresa no Drive, e os títulos liquidados fora do mês são avisados.
import type { Titulo } from '../tipos';

/** "AAAA-MM" (o valor do <input type="month">) */
export type Competencia = string;

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function competenciaValida(c: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(c);
  return !!m && +m[2] >= 1 && +m[2] <= 12;
}

/** O mês anterior ao de hoje (a conciliação costuma ser do mês que fechou). */
export function competenciaPadrao(hoje: Date): Competencia {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function partesDaCompetencia(c: Competencia): { ano: number; mes: number } {
  const [a, m] = c.split('-');
  return { ano: +a, mes: +m };
}

/** "08/2026" */
export function rotuloCompetencia(c: Competencia): string {
  if (!competenciaValida(c)) return '';
  const { ano, mes } = partesDaCompetencia(c);
  return String(mes).padStart(2, '0') + '/' + ano;
}

/** "agosto de 2026" */
export function competenciaPorExtenso(c: Competencia): string {
  if (!competenciaValida(c)) return '';
  const { ano, mes } = partesDaCompetencia(c);
  return MESES[mes - 1] + ' de ' + ano;
}

/** Títulos com a data de liquidação (DD/MM/AAAA) fora da competência. Sem data não conta. */
export function titulosForaDaCompetencia(titulos: Titulo[], c: Competencia): Titulo[] {
  if (!competenciaValida(c)) return [];
  const { ano, mes } = partesDaCompetencia(c);
  return titulos.filter(t => {
    const m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(t.liquidacao || '');
    return m && (+m[1] !== mes || +m[2] !== ano);
  });
}
