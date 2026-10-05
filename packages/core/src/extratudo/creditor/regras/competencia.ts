// A competência (mês/ano) da conciliação: o primeiro passo do Creditor. Com ela, o relatório de
// liquidação é buscado na pasta da empresa no Drive, e os títulos liquidados fora do mês são avisados.
// Pode ser mais de um mês (Vitor, 05/10/2026: a liquidação por período, nos meses em que o caixa teve
// CRÉD.LIQ.COBRANÇA): 'AAAA-MM,AAAA-MM', em ordem; um relatório por mês, juntos num só.
import type { Grupo, RelatorioBanco, Titulo } from '../tipos';

/** "AAAA-MM" (o valor do <input type="month">), ou vários: "AAAA-MM,AAAA-MM" */
export type Competencia = string;

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Um mês 'AAAA-MM' válido. */
export function mesValido(c: string): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(c);
  return !!m && +m[2] >= 1 && +m[2] <= 12;
}

/** Um mês, ou vários separados por vírgula: válida quando todos os meses são. */
export function competenciaValida(c: string): boolean {
  return c.split(',').every(mesValido);
}

/** Os meses da competência, em ordem e sem repetir. */
export function mesesDaCompetencia(c: Competencia): Competencia[] {
  return [...new Set(c.split(',').map(x => x.trim()).filter(mesValido))].sort();
}

/** A competência de vários meses (em ordem, sem repetir). */
export function competenciaDosMeses(meses: readonly string[]): Competencia {
  return [...new Set(meses.filter(mesValido))].sort().join(',');
}

const proximoMes = (c: Competencia) => {
  const [a, m] = c.split('-').map(Number);
  return m === 12 ? (a + 1) + '-01' : a + '-' + String(m + 1).padStart(2, '0');
};

/** O mês anterior ao de hoje (a conciliação costuma ser do mês que fechou). */
export function competenciaPadrao(hoje: Date): Competencia {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function partesDaCompetencia(c: Competencia): { ano: number; mes: number } {
  const [a, m] = c.split('-');
  return { ano: +a, mes: +m };
}

/** "08/2026"; vários seguidos: "06/2026 a 08/2026"; com buraco: "06/2026, 08/2026" */
export function rotuloCompetencia(c: Competencia): string {
  if (!competenciaValida(c)) return '';
  const ms = mesesDaCompetencia(c);
  if (ms.length > 1) {
    const seguidos = ms.every((m, i) => i === 0 || proximoMes(ms[i - 1]) === m);
    return seguidos ? rotuloCompetencia(ms[0]) + ' a ' + rotuloCompetencia(ms[ms.length - 1]) : ms.map(rotuloCompetencia).join(', ');
  }
  const { ano, mes } = partesDaCompetencia(c);
  return String(mes).padStart(2, '0') + '/' + ano;
}

/** "agosto de 2026" (vários meses: o rótulo, "06/2026 a 08/2026") */
export function competenciaPorExtenso(c: Competencia): string {
  if (!competenciaValida(c)) return '';
  if (mesesDaCompetencia(c).length > 1) return rotuloCompetencia(c);
  const { ano, mes } = partesDaCompetencia(c);
  return MESES[mes - 1] + ' de ' + ano;
}

/** Títulos com a data de liquidação (DD/MM/AAAA) fora da competência (de todos os meses dela). Sem data não conta. */
export function titulosForaDaCompetencia(titulos: Titulo[], c: Competencia): Titulo[] {
  if (!competenciaValida(c)) return [];
  const meses = new Set(mesesDaCompetencia(c));
  return titulos.filter(t => {
    const m = /^\d{2}\/(\d{2})\/(\d{4})$/.exec(t.liquidacao || '');
    return m && !meses.has(m[2] + '-' + m[1]);
  });
}

/**
 * Os relatórios de cada mês num só (a liquidação por período): os grupos um atrás do outro, renumerados (grupos e
 * títulos), e os totais somados.
 */
export function juntarRelatorios(rels: readonly RelatorioBanco[]): RelatorioBanco {
  if (rels.length === 1) return rels[0];
  let idGrupo = 1, idTitulo = 1;
  const grupos: Grupo[] = rels.flatMap(r => r.grupos.map(g => ({ ...g, id: idGrupo++, titulos: g.titulos.map(t => ({ ...t, id: idTitulo++ })) })));
  const soma = (k: keyof RelatorioBanco['totalGeral']) =>
    rels.some(r => r.totalGeral[k] == null) ? null : Math.round(rels.reduce((a, r) => a + (r.totalGeral[k] as number), 0) * 100) / 100;
  return {
    grupos,
    totalGeral: { valor: soma('valor'), mora: soma('mora'), desconto: soma('desconto'), outros: soma('outros'), cobrado: soma('cobrado') },
    registrosGeral: rels.some(r => r.registrosGeral == null) ? null : rels.reduce((a, r) => a + (r.registrosGeral as number), 0),
    ignorados: rels.reduce((a, r) => a + r.ignorados, 0),
    avisos: rels.flatMap(r => r.avisos),
  };
}
