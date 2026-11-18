// A tabela dos vencimentos que o cliente vê na Área do Cliente (Vitor, 16/10/2026).
// TABELA A CONFERIR PELO ESCRITÓRIO: o dia de cada obrigação e o que fazer quando cai em fim de semana. Os itens marcados
// "PRECISA CONFERIR" foram chutados e não podem ir ao ar sem o Fiscal e o DP olharem.
//
// Só as etapas desta tabela aparecem na agenda do cliente (agenda.ts): o resto da rotina é do escritório e não sai daqui.
// A chave é o id REAL da etapa em tarefas/rotinas/{fiscal,dp}.ts; o id que sai para o cliente é o `id` da linha (o da etapa
// é interno e não sai).
//
// OS FERIADOS ENTRAM desde 17/11/2026 (plano do Acessórias, ficha E01; frase do dono: "Fazer site e robô"): o dia útil vem
// do calendário único (tarefas/regras/diasUteis.ts), na esfera de cada linha. Tributo federal (DAS, DARF, PIS/COFINS,
// IRPJ/CSLL, eSocial, DCTFWeb, FGTS) pula só os feriados nacionais; o ICMS, os de MG (lista a confirmar); o ISS, também os
// de Taiobeiras. Antes era só segunda a sexta. Quem manda no prazo de verdade continua sendo o escritório (a agenda é um
// lembrete, não a lei). O robô usa esta mesma conta pelo robo/gerado/danfse.js (robo/area-cliente-regras.js).
//
// O DIA, O AJUSTE E A ESFERA vêm da tabela única de prazos desde 17/11/2026 (ficha E02; frase do dono: "Seguir para a
// E02"): tarefas/regras/prazos.ts, pela etapa. Aqui fica só o que é do cliente: quais etapas ele vê, o id e o nome.
// A única exceção é a DCTFWeb: o cliente vê o dia 15 (o dono, 17/11/2026: "Voltar para o 15"), enquanto o DP conta o 20,
// o do DARF dela (prazos.ts). A linha do cliente leva o `dia` próprio; o ajuste e a esfera continuam vindo da tabela.
import { ajustar, dataDe, type Esfera, isoDe, ultimoDiaUtil } from '../tarefas/regras/diasUteis';
import { PRAZOS, prazoLegal } from '../tarefas/regras/prazos';

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
  /** de quem é o tributo: decide quais feriados pulam o dia (federal só os nacionais; municipal também os de Taiobeiras) */
  esfera: Esfera;
  /** o que o escritório precisa conferir nesta linha */
  conferir?: string;
}

/** O que o cliente vê de cada etapa (o dia, o ajuste e a esfera vêm de PRAZOS). */
const DO_CLIENTE: readonly (Pick<Vencimento, 'id' | 'etapa' | 'nome' | 'conferir'> & { dia?: number })[] = [
  // ─── Fiscal ───────────────────────────────────────────────────────────────
  // o DAS posterga para o dia útil seguinte (o dono, 17/11/2026: "Posterga (regra oficial)")
  { id: 'das', etapa: 'fiscal-simples', nome: 'DAS do Simples Nacional' },
  { id: 'das-mei', etapa: 'fiscal-mei', nome: 'DAS do MEI', conferir: 'PRECISA CONFERIR: o DAS-MEI não estava na lista do Vitor; mesma regra do DAS' },
  { id: 'icms', etapa: 'fiscal-icms', nome: 'ICMS (imposto estadual)', conferir: 'PRECISA CONFERIR: dia 9 e o que fazer no fim de semana (aqui: posterga)' },
  { id: 'iss', etapa: 'fiscal-iss', nome: 'ISS (imposto da prefeitura)', conferir: 'PRECISA CONFERIR: dia 10 e o fim de semana variam por município' },
  { id: 'pis-cofins', etapa: 'fiscal-piscofins', nome: 'PIS e COFINS' },
  { id: 'pis-cofins', etapa: 'fiscal-piscofins-real', nome: 'PIS e COFINS' },
  // IRPJ/CSLL: a etapa só entra em mar/jun/set/dez (ver Etapa.meses)
  { id: 'irpj-csll', etapa: 'fiscal-irpj-csll', nome: 'IRPJ e CSLL do trimestre' },
  { id: 'irpj-csll-estimativa', etapa: 'fiscal-irpj-csll-real', nome: 'IRPJ e CSLL (estimativa do mês)' },
  // ─── Departamento Pessoal ─────────────────────────────────────────────────
  { id: 'esocial', etapa: 'dp-s1299', nome: 'Fechamento da folha no eSocial' },
  // o dia 15 só para o cliente (o dono, 17/11/2026: "Voltar para o 15"); o DP conta o 20
  { id: 'dctfweb', etapa: 'dp-dctfweb', nome: 'DCTFWeb (declaração da folha)', dia: 15 },
  { id: 'darf-inss', etapa: 'dp-darf', nome: 'DARF do INSS da folha' },
  { id: 'fgts', etapa: 'dp-fgts', nome: 'FGTS' },
];

/** A linha do cliente com o dia, o ajuste e a esfera da tabela única (os campos na mesma ordem de sempre: o robô compara). */
function comOPrazo(c: (typeof DO_CLIENTE)[number]): Vencimento {
  const p = PRAZOS.find(x => x.etapa === c.etapa);
  if (!p || p.dia === 'quinto-dia-util' || p.ajuste === 'mantem') throw new Error('vencimentos: a etapa ' + c.etapa + ' não tem prazo que sirva à agenda em tarefas/regras/prazos.ts');
  const v: Vencimento = { id: c.id, etapa: c.etapa, nome: c.nome, dia: c.dia ?? p.dia, mesesDepois: p.mesesDepois, ajuste: p.ajuste, esfera: p.esfera };
  if (c.conferir) v.conferir = c.conferir;
  return v;
}

export const VENCIMENTOS: Vencimento[] = DO_CLIENTE.map(comOPrazo);

const POR_ETAPA = new Map(VENCIMENTOS.map(v => [v.etapa, v]));

/** A linha da tabela de uma etapa; null = a etapa não aparece para o cliente. */
export function vencimentoDaEtapa(etapa: string): Vencimento | null {
  return POR_ETAPA.get(etapa) ?? null;
}

/** 'aaaa-mm-dd' de uma data (hora local). */
export const isoDaData = (d: Date): string => isoDe(d);

/** O dia útil anterior (ou o próprio dia, se já for útil), na esfera (federal: sem os feriados nacionais). */
export function diaUtilAnterior(d: Date, esfera: Esfera = 'federal'): Date {
  return dataDe(ajustar(isoDe(d), 'antecipa', esfera));
}

/** O próximo dia útil (ou o próprio dia, se já for útil), na esfera (federal: sem os feriados nacionais). */
export function proximoDiaUtil(d: Date, esfera: Esfera = 'federal'): Date {
  return dataDe(ajustar(isoDe(d), 'posterga', esfera));
}

/** O último dia útil de um mês (mes 1–12), na esfera. */
export function ultimoDiaUtilDoMes(ano: number, mes: number, esfera: Esfera = 'federal'): Date {
  return dataDe(ultimoDiaUtil(ano, mes - 1, esfera));
}

/** O vencimento de uma linha da tabela para uma competência 'aaaa-mm', em 'aaaa-mm-dd'; null se a competência for inválida. */
export function vencimentoNaCompetencia(v: Vencimento, competencia: string): string | null {
  return prazoLegal(v, competencia);
}

/** O vencimento (aaaa-mm-dd) da etapa na competência; null = a etapa não está na tabela do cliente. */
export function vencimentoDaEtapaNoMes(etapa: string, competencia: string): string | null {
  const v = vencimentoDaEtapa(etapa);
  return v ? vencimentoNaCompetencia(v, competencia) : null;
}
