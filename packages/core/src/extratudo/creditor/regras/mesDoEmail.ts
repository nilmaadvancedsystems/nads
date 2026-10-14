// O mês de que um e-mail fala (Vitor, 14/10/2026: "faça o robô já pré-filtrar resultados pelas palavras-chave, seja o mês, o ano,
// no corpo e título do e-mail"; "não tem por que eu ver coisa de dezembro ou de fevereiro sendo que estou em janeiro"). Procura no
// nome do anexo, no assunto e no trecho do corpo: "JAN2026", "janeiro", "Jan/26", "01/2026", "01.2026", "012026", "2026-01".
// Abreviação sozinha ("EXTRATO JAN.pdf") só vale no nome e no assunto: no corpo, "mar", "set", "out" são palavras comuns.
import type { AnexoDoEmail } from '../drive';

const NOMES: [string, string][] = [
  ['janeiro', '01'], ['fevereiro', '02'], ['marco', '03'], ['abril', '04'], ['maio', '05'], ['junho', '06'],
  ['julho', '07'], ['agosto', '08'], ['setembro', '09'], ['outubro', '10'], ['novembro', '11'], ['dezembro', '12'],
];
const ABREV: [string, string][] = NOMES.map(([n, m]) => [n.slice(0, 3), m]);

const anoDe = (s: string | undefined, padrao: string) => (!s ? padrao : s.length === 2 ? '20' + s : s);

/** Os meses ('aaaa-mm') que o texto cita. abrevSolta: aceita "JAN" sem o ano (nome do anexo e assunto). */
export function mesesCitados(texto: string, anoPadrao: string, abrevSolta = true): Set<string> {
  // sem acento e em minúsculas, mas com os separadores (/ . - _) para as datas
  const t = ' ' + String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9/.\-_]+/g, ' ') + ' ';
  const achados = new Set<string>();
  // pelo nome do mês, inteiro ("janeiro de 2026", "janeiro/26") ou abreviado com o ano ("jan2026", "jan/26", "jan-2026")
  for (const [nome, mm] of NOMES) {
    for (const m of t.matchAll(new RegExp('(?<![a-z])' + nome + '(?![a-z])(?:[\\s/._-]*(?:de\\s+)?(20\\d{2}|\\d{2})(?!\\d))?', 'g'))) achados.add(anoDe(m[1], anoPadrao) + '-' + mm);
  }
  for (const [ab, mm] of ABREV) {
    const re = new RegExp('(?<![a-z])' + ab + '(?![a-z])(?:[\\s/._-]*(20\\d{2}|\\d{2})(?!\\d))' + (abrevSolta ? '?' : ''), 'g');
    for (const m of t.matchAll(re)) achados.add(anoDe(m[1], anoPadrao) + '-' + mm);
  }
  // pelos números: mm/aaaa, mm.aaaa, mm-aaaa, mmaaaa (também dentro de dd/mm/aaaa), aaaa-mm e mm/aa (aa de 20 a 39)
  for (const m of t.matchAll(/(?<!\d)(0?[1-9]|1[0-2])[/._-]?(20\d{2})(?!\d)/g)) achados.add(m[2] + '-' + m[1].padStart(2, '0'));
  for (const m of t.matchAll(/(?<!\d)(20\d{2})[/._-](0[1-9]|1[0-2])(?![\d])/g)) achados.add(m[1] + '-' + m[2]);
  for (const m of t.matchAll(/(?<![\d/])(0[1-9]|1[0-2])[/.-]([23]\d)(?![\d/])/g)) achados.add('20' + m[2] + '-' + m[1]);
  return achados;
}

/** De que mês é o anexo, para o mês procurado: 'do-mes' (cita o mês), 'outro' (cita outros meses e não ele) ou 'sem' (não cita mês). */
export type MesDoAnexo = 'do-mes' | 'outro' | 'sem';

export function mesDoAnexo(a: Pick<AnexoDoEmail, 'nome' | 'assunto'> & { trecho?: string }, mes: string): MesDoAnexo {
  const ano = mes.slice(0, 4);
  const citados = new Set([...mesesCitados(a.nome.replace(/\.[a-z0-9]+$/i, ''), ano), ...mesesCitados(a.assunto, ano), ...mesesCitados(a.trecho || '', ano, false)]);
  if (citados.has(mes)) return 'do-mes';
  return citados.size ? 'outro' : 'sem';
}

/** Os anexos do mês primeiro, depois os que não citam mês; os de outros meses à parte (escondidos na tela). */
export function separarPeloMes<T extends Pick<AnexoDoEmail, 'nome' | 'assunto'> & { trecho?: string }>(anexos: readonly T[], mes: string): { doMes: T[]; semMes: T[]; outros: T[] } {
  const r = { doMes: [] as T[], semMes: [] as T[], outros: [] as T[] };
  for (const a of anexos) {
    const k = mesDoAnexo(a, mes);
    (k === 'do-mes' ? r.doMes : k === 'sem' ? r.semMes : r.outros).push(a);
  }
  return r;
}

