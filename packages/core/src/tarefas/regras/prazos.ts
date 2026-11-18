// A tabela de prazos das etapas: o prazo legal, o prazo interno e a multa (plano do Acessórias, 17/11/2026, ficha
// E02-tabela-de-prazos-das-etapas; frase do dono: "Seguir para a E02"). Uma tabela só para o escritório inteiro:
// - o DP (prazosDoDp.ts) lê daqui os dias e as fontes que tinha em PRAZOS_DO_DP (as mesmas datas de antes);
// - a agenda do cliente (areaCliente/vencimentos.ts) lê daqui o dia, o ajuste e a esfera das linhas que o cliente vê;
// - a lista de prazos do mês (E04) e os indicadores (E11) vão ler daqui.
// O dia útil vem do calendário único (diasUteis.ts). O Contábil não tem linhas: as fontes não dão prazo legal mensal para
// ele (a confirmar com o Contábil). O que falta o setor conferir está em `conferir` e em docs/acessorias/prazos-a-conferir.md.
// Só a lógica (sem tela e sem banco).
import { ajustar, dataDe, ehDiaUtil, enesimoDiaUtil, type Ajuste, type Esfera, isoDe, ultimoDiaUtil } from './diasUteis';

export type DepartamentoDoPrazo = 'fiscal' | 'dp' | 'contabil';

export interface PrazoDaEtapa {
  /** o departamento e o id REAL da etapa (tarefas/rotinas/*.ts) */
  departamento: DepartamentoDoPrazo;
  etapa: string;
  /** dia do mês, 'quinto-dia-util' ou 'ultimo-util' */
  dia: number | 'quinto-dia-util' | 'ultimo-util';
  /** 1 = o mês seguinte à competência */
  mesesDepois: number;
  ajuste: Ajuste;
  esfera: Esfera;
  /** o sábado conta como dia útil (o salário: CLT, art. 459) */
  sabadoUtil?: boolean;
  /** quantos dias úteis antes do prazo legal começa o prazo interno (padrão 3; a confirmar com cada setor) */
  diasAntes: number;
  /** o atraso desta obrigação gera multa ao cliente */
  multa: boolean;
  /** a lei, o manual ou "pedido do Vitor em dd/mm/aaaa" */
  fonte: string;
  /** o que falta o setor confirmar */
  conferir?: string;
}

const MULTA = 'multa a confirmar com o setor';
const ANTES = 3;

// a linha de cada etapa (o padrão: mês seguinte, antecipa, federal, 3 dias úteis antes)
const dp = (etapa: string, dia: PrazoDaEtapa['dia'], multa: boolean, fonte: string, mais: Partial<PrazoDaEtapa> = {}): PrazoDaEtapa => ({
  departamento: 'dp', etapa, dia, mesesDepois: 1, ajuste: 'antecipa', esfera: 'federal', diasAntes: ANTES, multa, fonte, conferir: MULTA, ...mais,
});
const fiscal = (etapa: string, dia: PrazoDaEtapa['dia'], multa: boolean, fonte: string, mais: Partial<PrazoDaEtapa> = {}): PrazoDaEtapa => ({
  departamento: 'fiscal', etapa, dia, mesesDepois: 1, ajuste: 'antecipa', esfera: 'federal', diasAntes: ANTES, multa, fonte, conferir: MULTA, ...mais,
});

export const PRAZOS: readonly PrazoDaEtapa[] = [
  // ─── DP (vinham de PRAZOS_DO_DP; as fontes são as mesmas) ────────────────────────────────────────────────────────
  dp('dp-recibos', 'quinto-dia-util', false, 'CLT, art. 459, § 1º', { sabadoUtil: true }),
  dp('dp-folha', 'quinto-dia-util', false, 'CLT, art. 459, § 1º', { sabadoUtil: true }),
  dp('dp-s1200', 15, true, 'Manual do eSocial (eventos periódicos)'),
  dp('dp-s1210', 15, true, 'Manual do eSocial (eventos periódicos)'),
  dp('dp-s1299', 15, true, 'Manual do eSocial (eventos periódicos)'),
  dp('dp-reinf', 15, true, 'IN RFB 2.043/2021'),
  // a DCTFWeb fica com o prazo do DARF dela, como o DP usa; o cliente vê o dia 15 (o dono, 17/11/2026: "Voltar para o 15";
  // a linha do cliente em areaCliente/vencimentos.ts leva o dia próprio)
  dp('dp-dctfweb', 20, true, 'Lei 8.212/1991, art. 30, I, "b" (o DARF da DCTFWeb)', {
    conferir: MULTA + '; a transmissão da DCTFWeb tem prazo próprio na IN RFB 2.005/2021 (o DP usa o dia 20 do DARF; a agenda do cliente mostra o 15)',
  }),
  dp('dp-darf', 20, true, 'Lei 8.212/1991, art. 30; Lei 11.196/2005, art. 70'),
  dp('dp-fgts', 20, true, 'Lei 8.036/1990, art. 15 (Lei 14.438/2022)'),
  dp('dp-econsignado', 20, false, 'na guia do FGTS Digital (Lei 8.036/1990, art. 15)'),
  // ─── Fiscal (vinham da agenda do cliente, VENCIMENTOS; os "PRECISA CONFERIR" continuam) ─────────────────────────
  // o DAS posterga para o dia útil seguinte, a regra oficial do Simples (o dono, 17/11/2026: "Posterga (regra oficial)";
  // antes o escritório antecipava)
  fiscal('fiscal-simples', 20, true, 'Simples Nacional: dia 20, prorrogado para o dia útil seguinte (o dono, 17/11/2026)', { ajuste: 'posterga', conferir: MULTA }),
  fiscal('fiscal-mei', 20, true, 'o mesmo do DAS (o dono, 17/11/2026)', { ajuste: 'posterga', conferir: MULTA + '; o DAS-MEI não estava na lista do Vitor' }),
  fiscal('fiscal-icms', 9, false, 'pedido do Vitor em 16/10/2026', { ajuste: 'posterga', esfera: 'estadual', conferir: MULTA + '; o dia 9 e o fim de semana dependem da atividade e do regime em MG' }),
  fiscal('fiscal-iss', 10, false, 'pedido do Vitor em 16/10/2026', { ajuste: 'posterga', esfera: 'municipal', conferir: MULTA + '; o dia 10 e o fim de semana variam por município' }),
  fiscal('fiscal-piscofins', 25, false, 'pedido do Vitor em 16/10/2026'),
  fiscal('fiscal-piscofins-real', 25, false, 'pedido do Vitor em 16/10/2026'),
  fiscal('fiscal-irpj-csll', 'ultimo-util', false, 'pedido do Vitor em 16/10/2026 (o último dia útil do mês seguinte ao trimestre)'),
  fiscal('fiscal-irpj-csll-real', 'ultimo-util', false, 'pedido do Vitor em 16/10/2026 (a estimativa mensal)'),
];

const POR_ETAPA = new Map(PRAZOS.map(p => [p.departamento + '|' + p.etapa, p]));

/** A linha da tabela de uma etapa; null = a etapa não tem prazo cadastrado. */
export function linhaDoPrazo(departamento: DepartamentoDoPrazo, etapa: string): PrazoDaEtapa | null {
  return POR_ETAPA.get(departamento + '|' + etapa) ?? null;
}

/** O ano e o mês (base 0) do vencimento: a competência 'aaaa-mm' mais `mesesDepois`; null se a competência for torta. */
function mesDoVencimento(competencia: string, mesesDepois: number): [number, number] | null {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1 + mesesDepois, 1);
  return [d.getFullYear(), d.getMonth()];
}

/** O prazo legal de uma linha na competência, já no dia útil ('aaaa-mm-dd'); null se a competência for torta. */
export function prazoLegal(p: Pick<PrazoDaEtapa, 'dia' | 'mesesDepois' | 'ajuste' | 'esfera' | 'sabadoUtil'>, competencia: string): string | null {
  const mes = mesDoVencimento(competencia, p.mesesDepois);
  if (!mes) return null;
  const [ano, mes0] = mes;
  if (p.dia === 'quinto-dia-util') return enesimoDiaUtil(ano, mes0, 5, p.esfera, !!p.sabadoUtil);
  if (p.dia === 'ultimo-util') return ultimoDiaUtil(ano, mes0, p.esfera, !!p.sabadoUtil);
  return ajustar(isoDe(new Date(ano, mes0, p.dia)), p.ajuste, p.esfera, !!p.sabadoUtil);
}

/** `n` dias úteis antes do dia 'aaaa-mm-dd', na esfera. */
export function diasUteisAntes(iso: string, n: number, esfera: Esfera, sabadoUtil = false): string {
  const d = dataDe(iso);
  for (let falta = n; falta > 0;) {
    d.setDate(d.getDate() - 1);
    if (ehDiaUtil(isoDe(d), esfera, sabadoUtil)) falta--;
  }
  return isoDe(d);
}

export interface PrazoNaCompetencia {
  /** a data-limite oficial ('aaaa-mm-dd') */
  legal: string;
  /** a data em que o escritório começa a cobrar o responsável ('aaaa-mm-dd') */
  interno: string;
  multa: boolean;
}

/** O prazo legal, o interno e a multa de uma etapa na competência; null = sem prazo cadastrado (ou competência torta). */
export function prazoDaEtapa(departamento: DepartamentoDoPrazo, etapa: string, competencia: string): PrazoNaCompetencia | null {
  const p = linhaDoPrazo(departamento, etapa);
  if (!p) return null;
  const legal = prazoLegal(p, competencia);
  if (!legal) return null;
  return { legal, interno: diasUteisAntes(legal, p.diasAntes, p.esfera, !!p.sabadoUtil), multa: p.multa };
}
