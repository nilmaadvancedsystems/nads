// O Registro da Área do Cliente, segunda volta (13/11/2026: "quero trabalhar no DP agora"; as escolhidas: avisos de férias,
// custo da folha, equipe mais completa e calendário do DP). Três regras:
//   - o histórico da folha pelas guias do FGTS (a base de cálculo é a remuneração; o total da guia é o FGTS do mês);
//   - as férias de cada um pelo tempo no registro (a primeira competência em que aparece nas guias), descontando as que já
//     têm recibo de férias; é uma estimativa (o escritório confirma pelo registro de verdade);
//   - o calendário do DP do mês: o salário até o 5º dia útil, o FGTS e o INSS no dia 20 (antecipa no fim de semana), o
//     fechamento do eSocial no dia 15, as parcelas do 13º, os aniversários de empresa e as férias que vencem no mês.
import type { GuiaDoFgts } from '../tarefas/regras/fgts';

const dois = (n: number) => String(n).padStart(2, '0');
const centavos = (n: number) => Math.round(n * 100) / 100;
const mesesEntre = (de: string, ate: string) => (Number(ate.slice(0, 4)) - Number(de.slice(0, 4))) * 12 + (Number(ate.slice(5, 7)) - Number(de.slice(5, 7)));
const somarMeses = (mes: string, n: number) => {
  const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 + n, 1);
  return d.getFullYear() + '-' + dois(d.getMonth() + 1);
};
const mesDe = (d: Date) => d.getFullYear() + '-' + dois(d.getMonth() + 1);

// ---------------------------------------------------------------------------------------------------- o histórico da folha
/** Um mês da folha: a soma das remunerações (a base do FGTS), o FGTS (o total das guias) e quantos funcionários. */
export interface MesDaFolha {
  competencia: string; base: number; fgts: number; funcionarios: number;
  // (13/11/2026) do holerite, quando o DP salvou a folha do mês (folhaLida.ts)
  proventos?: number; descontos?: number; liquido?: number; inss?: number; irrf?: number;
  /** quantos holerites entraram na conta */
  holerites?: number;
}

/** O histórico da folha pelas guias do FGTS (a mesma guia, pelo número, conta uma vez); os últimos 12 meses, o mais velho primeiro. */
export function historicoDaFolha(todas: readonly GuiaDoFgts[]): MesDaFolha[] {
  const guias = [...new Map(todas.map((g, i) => [g.numero || 'sem-numero-' + i, g])).values()];
  const porMes = new Map<string, { base: number; fgts: number; cpfs: Set<string> }>();
  for (const g of guias) {
    if (!/^\d{4}-\d{2}$/.test(g.competencia)) continue;
    const m = porMes.get(g.competencia) ?? { base: 0, fgts: 0, cpfs: new Set<string>() };
    m.fgts += g.total || 0;
    for (const t of g.trabalhadores) { m.base += t.base || 0; m.cpfs.add(t.cpf.replace(/\D/g, '')); }
    porMes.set(g.competencia, m);
  }
  return [...porMes].sort((a, b) => a[0].localeCompare(b[0])).slice(-12)
    .map(([competencia, m]) => ({ competencia, base: centavos(m.base), fgts: centavos(m.fgts), funcionarios: m.cpfs.size }));
}

// ------------------------------------------------------------------------------------------------------------- as férias
export type SituacaoDasFerias = 'vencida' | 'vence-logo' | 'tem' | 'a-adquirir';
export interface FeriasDoFuncionario {
  situacao: SituacaoDasFerias;
  /** períodos de férias completos e ainda sem recibo */
  pendentes: number;
  /** o último mês para tirar o período mais antigo sem recibo ('aaaa-mm') */
  limite?: string;
  /** quando o próximo período completa ('aaaa-mm') */
  aPartirDe?: string;
  /** em português, para a lista */
  texto: string;
}
const mesBr = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);

/**
 * As férias pelo tempo no registro, olhando só o período mais recente (13/11/2026): cada 12 meses dão um período, que
 * precisa ser tirado nos 12 meses seguintes. O espelho só tem os documentos do DP dos últimos meses, então os períodos
 * antigos não dá para conferir (contar como vencidos daria alarme falso): vale o último período completo, que está em dia
 * quando há um recibo de férias depois de ele completar (recibos = as competências dos recibos de férias da pessoa).
 */
export function feriasDoFuncionario(desde: string, hoje: Date, recibos: readonly string[] = []): FeriasDoFuncionario {
  const agora = mesDe(hoje);
  const completos = Math.floor(Math.max(0, mesesEntre(desde, agora)) / 12);
  const proximo = somarMeses(desde, 12 * (completos + 1));
  if (!completos) return { situacao: 'a-adquirir', pendentes: 0, aPartirDe: proximo, texto: 'Primeiras férias a partir de ' + mesBr(proximo) };
  const fimDoPeriodo = somarMeses(desde, 12 * completos);
  if (recibos.some(c => c >= fimDoPeriodo)) return { situacao: 'a-adquirir', pendentes: 0, aPartirDe: proximo, texto: 'Férias em dia · as próximas a partir de ' + mesBr(proximo) };
  const limite = somarMeses(fimDoPeriodo, 11);
  const faltam = mesesEntre(agora, limite);
  const periodo = 'período ' + mesBr(somarMeses(fimDoPeriodo, -12)) + ' a ' + mesBr(somarMeses(fimDoPeriodo, -1));
  if (faltam < 0) return { situacao: 'vencida', pendentes: 1, limite, texto: 'Venceu em ' + mesBr(limite) + ' · ' + periodo };
  if (faltam <= 3) return { situacao: 'vence-logo', pendentes: 1, limite, texto: 'Tirar até ' + mesBr(limite) + ' · ' + periodo };
  return { situacao: 'tem', pendentes: 1, limite, texto: 'Pode tirar até ' + mesBr(limite) + ' · ' + periodo };
}

const dataBr = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
const isoDoDia = (d: Date) => d.getFullYear() + '-' + dois(d.getMonth() + 1) + '-' + dois(d.getDate());

/**
 * As férias pelos períodos de verdade (a previsão de férias do DP, 13/11/2026): o período completo mais antigo com dias a
 * gozar manda (vencida depois do "conceder até"; vence logo nos 3 meses antes); sem período completo, a pessoa ainda está
 * adquirindo. Os mesmos rótulos da estimativa (feriasDoFuncionario), para a tela não mudar.
 */
export function feriasPelaFolha(periodos: readonly { inicio: string; fim: string; aGozar: number; concederAte: string }[], hoje: Date): FeriasDoFuncionario | null {
  const dia = isoDoDia(hoje);
  const validos = periodos.filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.fim) && /^\d{4}-\d{2}-\d{2}$/.test(p.concederAte) && p.aGozar > 0)
    .sort((a, b) => a.concederAte.localeCompare(b.concederAte));
  if (!validos.length) return null;
  const completos = validos.filter(p => p.fim < dia);
  const periodo = (p: { inicio: string; fim: string }) => 'período ' + dataBr(p.inicio) + ' a ' + dataBr(p.fim);
  if (!completos.length) {
    const p = validos[0];
    const d = new Date(Number(p.fim.slice(0, 4)), Number(p.fim.slice(5, 7)) - 1, Number(p.fim.slice(8, 10)) + 1);
    const aPartirDe = mesDe(d);
    return { situacao: 'a-adquirir', pendentes: 0, aPartirDe, texto: 'Férias a partir de ' + dataBr(isoDoDia(d)) + ' · ' + periodo(p) };
  }
  const p = completos[0];
  const limite = p.concederAte.slice(0, 7);
  const dias = p.aGozar + (p.aGozar === 1 ? ' dia' : ' dias') + ' a tirar';
  const base = { pendentes: completos.length, limite };
  if (p.concederAte < dia) return { ...base, situacao: 'vencida', texto: 'Venceu em ' + dataBr(p.concederAte) + ' · ' + dias + ' · ' + periodo(p) };
  if (mesesEntre(mesDe(hoje), limite) <= 3) return { ...base, situacao: 'vence-logo', texto: 'Tirar até ' + dataBr(p.concederAte) + ' · ' + dias + ' · ' + periodo(p) };
  return { ...base, situacao: 'tem', texto: 'Pode tirar até ' + dataBr(p.concederAte) + ' · ' + dias + ' · ' + periodo(p) };
}

/** A ordem dos avisos: a vencida primeiro, depois a que vence logo, a que já pode tirar e por fim a que ainda vai completar. */
export const ORDEM_DAS_FERIAS: Record<SituacaoDasFerias, number> = { vencida: 0, 'vence-logo': 1, tem: 2, 'a-adquirir': 3 };

// -------------------------------------------------------------------------------------------------- o calendário do DP
export type TipoDaDataDoDp = 'salario' | 'fgts' | 'inss' | 'esocial' | 'decimo' | 'aniversario' | 'ferias';
export interface DataDoDp { dia: number | null; titulo: string; detalhe: string; tipo: TipoDaDataDoDp }

const ehUtil = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
/** o n-ésimo dia útil do mês (sem os feriados: o escritório confirma) */
function diaUtil(ano: number, mes0: number, n: number): number {
  let conta = 0;
  for (let dia = 1; dia <= 31; dia++) {
    const d = new Date(ano, mes0, dia);
    if (d.getMonth() !== mes0) break;
    if (ehUtil(d) && ++conta === n) return dia;
  }
  return 1;
}
/** o dia, ou o dia útil antes dele quando cai no fim de semana */
function antecipado(ano: number, mes0: number, dia: number): number {
  const ultimo = new Date(ano, mes0 + 1, 0).getDate();
  let d = Math.min(dia, ultimo);
  while (d > 1 && !ehUtil(new Date(ano, mes0, d))) d--;
  return d;
}

/** As datas do DP no mês ('aaaa-mm'), por dia; os aniversários de empresa e as férias do mês sem dia, no fim. */
export function calendarioDoDp(mes: string, funcionarios: readonly { nome: string; desde: string; ativo: boolean; ferias?: FeriasDoFuncionario }[]): DataDoDp[] {
  const ano = Number(mes.slice(0, 4)), m0 = Number(mes.slice(5, 7)) - 1;
  const ativos = funcionarios.filter(f => f.ativo);
  const datas: DataDoDp[] = [];
  if (ativos.length) {
    datas.push({ dia: diaUtil(ano, m0, 5), titulo: 'Pagamento do salário', detalhe: 'Até o 5º dia útil · ' + ativos.length + (ativos.length === 1 ? ' funcionário' : ' funcionários'), tipo: 'salario' });
    datas.push({ dia: 15, titulo: 'Fechamento da folha no eSocial', detalhe: 'O escritório entrega', tipo: 'esocial' });
    datas.push({ dia: antecipado(ano, m0, 20), titulo: 'FGTS do mês', detalhe: 'A guia vem do escritório', tipo: 'fgts' });
    datas.push({ dia: antecipado(ano, m0, 20), titulo: 'INSS (DCTFWeb)', detalhe: 'A guia vem do escritório', tipo: 'inss' });
    if (m0 === 10) datas.push({ dia: antecipado(ano, m0, 30), titulo: '13º salário · 1ª parcela', detalhe: 'Metade do salário, sem descontos', tipo: 'decimo' });
    if (m0 === 11) datas.push({ dia: antecipado(ano, m0, 20), titulo: '13º salário · 2ª parcela', detalhe: 'O restante, com os descontos', tipo: 'decimo' });
  }
  for (const f of ativos) {
    const anos = mesesEntre(f.desde, mes) / 12;
    if (anos >= 1 && Number.isInteger(anos)) datas.push({ dia: null, titulo: f.nome + ' faz ' + anos + (anos === 1 ? ' ano' : ' anos') + ' de empresa', detalhe: 'No registro desde ' + mesBr(f.desde), tipo: 'aniversario' });
    if (f.ferias?.limite === mes && (f.ferias.situacao === 'vence-logo' || f.ferias.situacao === 'tem')) datas.push({ dia: null, titulo: 'Últimas semanas para as férias de ' + f.nome, detalhe: 'O período vence no fim do mês', tipo: 'ferias' });
  }
  return datas.sort((a, b) => (a.dia ?? 99) - (b.dia ?? 99));
}
