// Um calendário só de dias úteis e feriados para o sistema inteiro (plano do Acessórias, 17/11/2026, ficha
// E01-calendario-de-dias-uteis; frase do dono: "Começar pela E01", 17/11/2026). Antes havia três calendários soltos: o
// feriadoNacional das etiquetas da folha, os feriados de Taiobeiras (feriados.ts) e o "só segunda a sexta" da agenda do
// cliente. Daqui em diante quem decide se um dia é útil é este arquivo. Só a lógica (sem tela e sem banco).
//
// A esfera do prazo manda em quais feriados contam:
// - federal: os feriados nacionais (feriadoNacional: os fixos e a Sexta-feira Santa);
// - estadual: os nacionais + os de MG. A LISTA DE MG ESTÁ VAZIA: a confirmar com o Fiscal (FERIADOS_DE_MG abaixo);
// - municipal: os nacionais + os feriados de Taiobeiras (feriados.ts, tipo 'feriado').
// O feriado municipal SÓ vale para tributo municipal (ISS): um feriado de Taiobeiras nunca desloca um DARF ou um DAS (o
// erro que o Acessórias comete quando a cidade cadastra o feriado e ele empurra o tributo federal). O ponto facultativo e o
// meio expediente não fecham prazo: o dia continua útil.
//
// ATENÇÃO, ANO NOVO: os feriados de Taiobeiras vêm do decreto de cada ano (feriados.ts só tem 2026 e 01/01/2027). Sem o
// decreto novo, em 2027 a esfera municipal fica igual à federal.
import { feriadoNacional } from './etiquetasDaFolha';
import { feriadoDoDia } from './feriados';

export type Esfera = 'federal' | 'estadual' | 'municipal';
/** O que fazer quando o dia cai em dia não útil: antecipa (anda para trás), posterga (para frente) ou mantém. */
export type Ajuste = 'antecipa' | 'posterga' | 'mantem';

/** Os feriados estaduais de Minas Gerais ('AAAA-MM-DD'). A confirmar com o Fiscal: por ora nenhum. */
export const FERIADOS_DE_MG: readonly string[] = [];

const dois = (n: number) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD' de uma data (hora local). */
export const isoDe = (d: Date): string => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());

/** A data (hora local, meia-noite) de 'AAAA-MM-DD'. */
export function dataDe(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/** O dia é feriado nessa esfera? (o fim de semana não entra aqui: veja ehDiaUtil) */
export function ehFeriado(iso: string, esfera: Esfera): boolean {
  if (feriadoNacional(dataDe(iso))) return true;
  if (esfera === 'estadual') return FERIADOS_DE_MG.includes(iso);
  if (esfera === 'municipal') return feriadoDoDia(iso)?.tipo === 'feriado';
  return false;
}

/** O dia é útil nessa esfera? Domingo nunca; sábado só com sabadoUtil (o salário: CLT, art. 459). */
export function ehDiaUtil(iso: string, esfera: Esfera, sabadoUtil = false): boolean {
  const dia = dataDe(iso).getDay();
  if (dia === 0 || (dia === 6 && !sabadoUtil)) return false;
  return !ehFeriado(iso, esfera);
}

/** O dia útil mais perto na direção do ajuste (o próprio dia, se já for útil); 'mantem' devolve o mesmo dia. */
export function ajustar(iso: string, ajuste: Ajuste, esfera: Esfera, sabadoUtil = false): string {
  if (ajuste === 'mantem') return iso;
  const d = dataDe(iso);
  while (!ehDiaUtil(isoDe(d), esfera, sabadoUtil)) d.setDate(d.getDate() + (ajuste === 'antecipa' ? -1 : 1));
  return isoDe(d);
}

/** O n-ésimo dia útil do mês (mes0 base 0), 'AAAA-MM-DD'. */
export function enesimoDiaUtil(ano: number, mes0: number, n: number, esfera: Esfera, sabadoUtil = false): string {
  const d = new Date(ano, mes0, 1);
  let uteis = 0;
  for (;;) {
    if (ehDiaUtil(isoDe(d), esfera, sabadoUtil)) uteis++;
    if (uteis >= n) return isoDe(d);
    d.setDate(d.getDate() + 1);
  }
}

/** O último dia útil do mês (mes0 base 0), 'AAAA-MM-DD'. */
export function ultimoDiaUtil(ano: number, mes0: number, esfera: Esfera, sabadoUtil = false): string {
  return ajustar(isoDe(new Date(ano, mes0 + 1, 0)), 'antecipa', esfera, sabadoUtil);
}
