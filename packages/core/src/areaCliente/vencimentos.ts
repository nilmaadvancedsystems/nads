// A tabela dos vencimentos que o cliente vê na Área do Cliente (Vitor, 16/10/2026).
// TABELA A CONFERIR PELO ESCRITÓRIO: o dia de cada obrigação e o que fazer quando cai em fim de semana. Os itens marcados
// "PRECISA CONFERIR" foram chutados e não podem ir ao ar sem o Fiscal e o DP olharem.
//
// Só as etapas desta tabela aparecem na agenda do cliente (agenda.ts): o resto da rotina é do escritório e não sai daqui.
// A chave é o id REAL da etapa em tarefas/rotinas/{fiscal,dp}.ts; o id que sai para o cliente é o `id` da linha (o da etapa
// é interno e não sai).
//
// FERIADOS NÃO ENTRAM: o dia útil aqui é só segunda a sexta. Um feriado nacional/estadual/municipal em cima do vencimento
// não desloca nada nesta tabela; quem manda no prazo de verdade é o escritório (a agenda é um lembrete, não a lei).

/** O que fazer quando o dia do vencimento cai em sábado ou domingo. */
export type AjusteDeFimDeSemana = 'antecipa' | 'posterga';

export interface Vencimento {
  /** o id que sai para o cliente (curto, sem cara de sistema) */
  id: string;
  /** o id da etapa na rotina (tarefas/rotinas) */
  etapa: string;
  /** o nome em português simples, como o cliente conhece */
  nome: string;
  /** dia do mês do vencimento, ou 'ultimo-util' = o último dia útil do mês */
  dia: number | 'ultimo-util';
  /** quantos meses depois do mês da competência (1 = o mês seguinte) */
  mesesDepois: number;
  ajuste: AjusteDeFimDeSemana;
  /** o que o escritório precisa conferir nesta linha */
  conferir?: string;
}

export const VENCIMENTOS: Vencimento[] = [
  // ─── Fiscal ───────────────────────────────────────────────────────────────
  // DAS do Simples: dia 20 do mês seguinte; antecipa (regra pedida pelo Vitor; a lei do Simples prorroga para o dia útil seguinte — PRECISA CONFERIR)
  { id: 'das', etapa: 'fiscal-simples', nome: 'DAS do Simples Nacional', dia: 20, mesesDepois: 1, ajuste: 'antecipa', conferir: 'DAS: o escritório antecipa; a regra oficial prorroga para o dia útil seguinte' },
  { id: 'das-mei', etapa: 'fiscal-mei', nome: 'DAS do MEI', dia: 20, mesesDepois: 1, ajuste: 'antecipa', conferir: 'PRECISA CONFERIR: o DAS-MEI não estava na lista do Vitor; mesma regra do DAS' },
  // ICMS de MG: dia 9 (PRECISA CONFERIR: o prazo depende da atividade/CNAE e do regime; MG também tem prazos em outros dias)
  { id: 'icms', etapa: 'fiscal-icms', nome: 'ICMS (imposto estadual)', dia: 9, mesesDepois: 1, ajuste: 'posterga', conferir: 'PRECISA CONFERIR: dia 9 e o que fazer no fim de semana (aqui: posterga)' },
  // ISS: dia 10 (PRECISA CONFERIR: varia por município)
  { id: 'iss', etapa: 'fiscal-iss', nome: 'ISS (imposto da prefeitura)', dia: 10, mesesDepois: 1, ajuste: 'posterga', conferir: 'PRECISA CONFERIR: dia 10 e o fim de semana variam por município' },
  // PIS/COFINS: dia 25 do mês seguinte (federal: antecipa)
  { id: 'pis-cofins', etapa: 'fiscal-piscofins', nome: 'PIS e COFINS', dia: 25, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'pis-cofins', etapa: 'fiscal-piscofins-real', nome: 'PIS e COFINS', dia: 25, mesesDepois: 1, ajuste: 'antecipa' },
  // IRPJ/CSLL: o último dia útil do mês seguinte ao trimestre (a etapa só entra em mar/jun/set/dez, ver Etapa.meses)
  { id: 'irpj-csll', etapa: 'fiscal-irpj-csll', nome: 'IRPJ e CSLL do trimestre', dia: 'ultimo-util', mesesDepois: 1, ajuste: 'antecipa' },
  // Real: a estimativa mensal, o último dia útil do mês seguinte
  { id: 'irpj-csll-estimativa', etapa: 'fiscal-irpj-csll-real', nome: 'IRPJ e CSLL (estimativa do mês)', dia: 'ultimo-util', mesesDepois: 1, ajuste: 'antecipa' },
  // ─── Departamento Pessoal ─────────────────────────────────────────────────
  { id: 'esocial', etapa: 'dp-s1299', nome: 'Fechamento da folha no eSocial', dia: 15, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'dctfweb', etapa: 'dp-dctfweb', nome: 'DCTFWeb (declaração da folha)', dia: 15, mesesDepois: 1, ajuste: 'antecipa' },
  // DARF previdenciário (INSS da folha): dia 20
  { id: 'darf-inss', etapa: 'dp-darf', nome: 'DARF do INSS da folha', dia: 20, mesesDepois: 1, ajuste: 'antecipa' },
  { id: 'fgts', etapa: 'dp-fgts', nome: 'FGTS', dia: 20, mesesDepois: 1, ajuste: 'antecipa' },
];

const POR_ETAPA = new Map(VENCIMENTOS.map(v => [v.etapa, v]));

/** A linha da tabela de uma etapa; null = a etapa não aparece para o cliente. */
export function vencimentoDaEtapa(etapa: string): Vencimento | null {
  return POR_ETAPA.get(etapa) ?? null;
}

const dois = (n: number) => String(n).padStart(2, '0');
const fimDeSemana = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** 'aaaa-mm-dd' de uma data (hora local). */
export function isoDaData(d: Date): string {
  return d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());
}

/** O dia útil anterior (ou o próprio dia, se já for útil): só tira sábado e domingo, sem feriados. */
export function diaUtilAnterior(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (fimDeSemana(r)) r.setDate(r.getDate() - 1);
  return r;
}

/** O próximo dia útil (ou o próprio dia, se já for útil): só tira sábado e domingo, sem feriados. */
export function proximoDiaUtil(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (fimDeSemana(r)) r.setDate(r.getDate() + 1);
  return r;
}

/** O último dia útil de um mês (mes 1–12): o último dia do mês, recuando se cair no fim de semana. */
export function ultimoDiaUtilDoMes(ano: number, mes: number): Date {
  return diaUtilAnterior(new Date(ano, mes, 0));
}

/** O vencimento de uma linha da tabela para uma competência 'aaaa-mm', em 'aaaa-mm-dd'; null se a competência for inválida. */
export function vencimentoNaCompetencia(v: Vencimento, competencia: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return null;
  const mes0 = Number(m[2]) - 1 + v.mesesDepois;
  const ano = Number(m[1]) + Math.floor(mes0 / 12);
  const mes = (mes0 % 12) + 1;
  if (Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  if (v.dia === 'ultimo-util') return isoDaData(ultimoDiaUtilDoMes(ano, mes));
  const data = new Date(ano, mes - 1, v.dia);
  return isoDaData(v.ajuste === 'antecipa' ? diaUtilAnterior(data) : proximoDiaUtil(data));
}

/** O vencimento (aaaa-mm-dd) da etapa na competência; null = a etapa não está na tabela do cliente. */
export function vencimentoDaEtapaNoMes(etapa: string, competencia: string): string | null {
  const v = vencimentoDaEtapa(etapa);
  return v ? vencimentoNaCompetencia(v, competencia) : null;
}
