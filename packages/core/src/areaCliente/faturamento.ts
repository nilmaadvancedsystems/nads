// O Faturamento na Área do Cliente (12/11/2026: "quero o faturamento do cliente aqui via fiscal"). A mesma fonte da
// relação de faturamento do Fiscal (tarefas/sieg/faturamento.ts): as notas emitidas no SIEG, siegSaidas/{código}_{AAAA-MM}
// (a soma das NF-e e NFC-e emitidas no mês, sem as canceladas; a NFS-e não entra). O robô (robo/area-cliente.js) monta o
// resumo dos últimos 12 meses de cada empresa do link e grava em resumo/faturamento; a tela só desenha. Sem dado no mês,
// a célula fica vazia: nada é inventado.
import * as XLSX from 'xlsx';
import type { SaidasSieg } from '../tarefas/sieg';
import type { NotasDoMes } from './notasDoMes';
import { FONTE_SIEG, mesesDoDetalhe } from '../tarefas/sieg/faturamento';

export interface MesDoFaturamento {
  /** 'aaaa-mm' */
  competencia: string;
  nfe: number | null;
  nfce: number | null;
  /** quantas notas (sem as canceladas) */
  notas: number;
  /** null = o mês não veio do SIEG */
  total: number | null;
  /** contra o mês anterior com dado, em % */
  variacao: number | null;
  /** as notas canceladas no mês (12/11/2026, o detalhamento) */
  canceladas?: number;
  /** cada série emitida no mês: a numeração, as notas e o valor (12/11/2026, o detalhamento) */
  series?: SerieDoMes[];
  /** o resumo das notas do mês (o painel do mês: por dia, os clientes, as operações), quando o SIEG baixou os XMLs */
  notasDoMes?: NotasDoMes;
}

/** Uma série de notas do mês: modelo '55' (NF-e) ou '65' (NFC-e). */
export interface SerieDoMes { modelo: string; serie: string; primeira: number | null; ultima: number | null; notas: number; canceladas: number; valor: number }

/** As séries do mês pelo SIEG, a NF-e antes da NFC-e. As notas não contam as canceladas. */
export function seriesDoMes(s: SaidasSieg | null | undefined): SerieDoMes[] {
  if (!s) return [];
  return s.series.map(x => {
    const nums = x.numeros.filter(n => Number.isFinite(n));
    return {
      modelo: String(x.modelo), serie: String(x.serie),
      primeira: nums.length ? Math.min(...nums) : null, ultima: nums.length ? Math.max(...nums) : null,
      notas: nums.length - x.canceladas.length, canceladas: x.canceladas.length, valor: Math.round((Number(x.valor) || 0) * 100) / 100,
    };
  }).sort((a, b) => a.modelo.localeCompare(b.modelo) || a.serie.localeCompare(b.serie, 'pt-BR', { numeric: true }));
}

/** regime (12/11/2026): o que vale no cadastro (Simples, MEI, Presumido…), para o limite do Simples/MEI; '' = não sei */
export interface FaturamentoDaEmpresa { codigo: number; nome: string; regime?: string; meses: MesDoFaturamento[] }

/** O que vai para o espelho (resumo/faturamento). */
export interface ResumoDoFaturamento { empresas: FaturamentoDaEmpresa[]; fonte: string; atualizadoEm: string }

const dois = (n: number) => String(n).padStart(2, '0');

/**
 * Os meses que o robô junta, do mais antigo ao mais novo: de janeiro do ano passado até o mês de hoje (12/11/2026: para o
 * acumulado do ano comparar com o mesmo período do ano passado; o gráfico e a tabela mostram só os 12 últimos).
 */
export function competenciasDoFaturamento(hoje: Date): string[] {
  const n = 12 + hoje.getMonth() + 1;
  return Array.from({ length: n }, (_, i) => { const d = new Date(hoje.getFullYear() - 1, i, 1); return d.getFullYear() + '-' + dois(d.getMonth() + 1); });
}

/**
 * O faturamento das empresas do link: os 12 meses de cada uma pelas saídas do SIEG. A empresa sem nenhum mês fica de
 * fora; sem nenhuma, null (a aba diz que ainda não chegou).
 */
export function faturamentoDoCliente(empresas: readonly { codigo: number; nome: string; regime?: string }[], competencias: readonly string[],
  saidas: (codigo: number, competencia: string) => SaidasSieg | null | undefined, agora: Date,
  notas?: (codigo: number, competencia: string) => NotasDoMes | null | undefined): ResumoDoFaturamento | null {
  const comDado = empresas
    .map(e => ({ codigo: e.codigo, nome: e.nome, regime: e.regime ?? '', meses: mesesDoDetalhe(competencias, c => saidas(e.codigo, c)).map(m => ({
      competencia: m.competencia, nfe: m.nfe, nfce: m.nfce, notas: m.notas, total: m.total, variacao: m.variacao,
      ...(m.total == null ? {} : { canceladas: m.canceladas, series: seriesDoMes(saidas(e.codigo, m.competencia)) }),
      ...(() => { const r = notas?.(e.codigo, m.competencia); return r ? { notasDoMes: r } : {}; })(),
    })) }))
    .filter(e => e.meses.some(m => m.total != null));
  return comDado.length ? { empresas: comDado, fonte: FONTE_SIEG, atualizadoEm: agora.toISOString() } : null;
}

// ---------- o painel da tela (12/11/2026: "preciso de melhora no faturamento") ----------

/**
 * Os limites de receita bruta por ano-calendário (jan–dez). Simples: R$ 4,8 milhões, com o sublimite de R$ 3,6 milhões
 * do ICMS/ISS (LC 123/2006, art. 3º e 13-A). MEI: R$ 81 mil (LC 123/2006, art. 18-A). PRECISA CONFERIR a cada ano: há
 * projeto para subir o teto do MEI. No ano de abertura o limite é proporcional aos meses (não tratado aqui).
 */
export const LIMITES_DO_REGIME: Record<string, { teto: number; sublimite: number | null; nome: string }> = {
  Simples: { teto: 4_800_000, sublimite: 3_600_000, nome: 'Simples Nacional' },
  MEI: { teto: 81_000, sublimite: null, nome: 'MEI' },
};
/** a partir de quanto do teto o cartão avisa "perto do limite" */
export const PERTO_DO_LIMITE = 0.8;

export interface LimiteDoRegime {
  nome: string; teto: number; sublimite: number | null;
  /** a receita do ano até agora (com o mês em andamento) */
  usado: number;
  /** de 0 a 1 (pode passar de 1) */
  fracao: number;
  situacao: 'ok' | 'perto' | 'sublimite' | 'passou';
}

export interface PainelDoFaturamento {
  /** os 12 meses do gráfico e da tabela (o último é o de hoje) */
  meses: MesDoFaturamento[];
  /** o mês de hoje: ainda entram notas, então não conta como mês fechado */
  emAndamento: string;
  /** o último mês fechado com nota (a variação é contra o anterior com nota) */
  ultimo: MesDoFaturamento | null;
  /** os 12 meses fechados antes do mês de hoje (a mesma janela da receita bruta dos 12 meses do Simples) */
  doze: { total: number; media: number; mesesComDado: number };
  /** o ano até o último mês fechado, contra os mesmos meses do ano passado (só se todos eles tiverem nota) */
  ano: { ano: number; ate: string; total: number; anterior: number | null; variacao: number | null } | null;
  /** só no Simples e no MEI */
  limite: LimiteDoRegime | null;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const somaDos = (ms: readonly MesDoFaturamento[]) => centavos(ms.reduce((t, m) => t + (m.total ?? 0), 0));

function mesAntes(c: string, n: number): string {
  const d = new Date(Number(c.slice(0, 4)), Number(c.slice(5, 7)) - 1 - n, 1);
  return d.getFullYear() + '-' + dois(d.getMonth() + 1);
}

/** O painel do Faturamento de uma empresa, para o dia de hoje. */
export function painelDoFaturamento(meses: readonly MesDoFaturamento[], regime: string | undefined, hoje: Date): PainelDoFaturamento {
  const atual = hoje.getFullYear() + '-' + dois(hoje.getMonth() + 1);
  const ordem = meses.filter(m => m.competencia <= atual).sort((a, b) => a.competencia.localeCompare(b.competencia));
  const porMes = new Map(ordem.map(m => [m.competencia, m]));
  const vazio = (c: string): MesDoFaturamento => ({ competencia: c, nfe: null, nfce: null, notas: 0, total: null, variacao: null });
  const comDado = ordem.filter(m => m.competencia < atual && m.total != null);
  const dozeFechados = comDado.filter(m => m.competencia >= mesAntes(atual, 12));

  const ano = hoje.getFullYear();
  const doAno = ordem.filter(m => m.competencia < atual && m.competencia.startsWith(ano + '-'));
  let resumoDoAno: PainelDoFaturamento['ano'] = null;
  const ateMes = hoje.getMonth(); // janeiro..o mês passado
  if (ateMes > 0 && doAno.some(m => m.total != null)) {
    const ate = ano + '-' + dois(ateMes);
    const passados = Array.from({ length: ateMes }, (_, i) => porMes.get((ano - 1) + '-' + dois(i + 1)));
    const anterior = passados.every(m => m?.total != null) ? somaDos(passados as MesDoFaturamento[]) : null;
    const total = somaDos(doAno);
    resumoDoAno = { ano, ate, total, anterior, variacao: anterior ? Math.round(((total - anterior) / anterior) * 1000) / 10 : null };
  }

  const regra = regime ? LIMITES_DO_REGIME[regime] : undefined;
  let limite: LimiteDoRegime | null = null;
  if (regra) {
    const usado = somaDos(ordem.filter(m => m.competencia.startsWith(ano + '-')));
    const fracao = usado / regra.teto;
    const situacao = usado > regra.teto ? 'passou' : regra.sublimite != null && usado > regra.sublimite ? 'sublimite' : fracao >= PERTO_DO_LIMITE ? 'perto' : 'ok';
    limite = { nome: regra.nome, teto: regra.teto, sublimite: regra.sublimite, usado, fracao, situacao };
  }

  const totalDoze = somaDos(dozeFechados);
  return {
    meses: competenciasDoFaturamento(hoje).slice(-12).map(c => porMes.get(c) ?? vazio(c)),
    emAndamento: atual,
    ultimo: comDado[comDado.length - 1] ?? null,
    doze: { total: totalDoze, media: dozeFechados.length ? centavos(totalDoze / dozeFechados.length) : 0, mesesComDado: dozeFechados.length },
    ano: resumoDoAno,
    limite,
  };
}

const FORMATO_REAIS = '"R$" #,##0.00';

/**
 * A planilha do faturamento (o "Baixar planilha", 12/11/2026: com o ícone do Excel, um .xlsx de verdade): o nome da
 * empresa e a fonte no alto, depois um mês por linha, do mais novo ao mais antigo (todos os que vieram, até 24), com os
 * valores como número em reais (o cliente pode somar no Excel). O mês sem nota fica em branco.
 */
export function planilhaDoFaturamento(empresa: { nome: string; meses: readonly MesDoFaturamento[] }, fonte: string): Uint8Array<ArrayBuffer> {
  const meses = [...empresa.meses].sort((a, b) => b.competencia.localeCompare(a.competencia));
  const aoa: (string | number | null)[][] = [
    [empresa.nome], [fonte], [],
    ['Mês', 'NF-e', 'NFC-e', 'Notas', 'Canceladas', 'Total', 'Variação (%)'],
    ...meses.map(m => [
      m.competencia.slice(5, 7) + '/' + m.competencia.slice(0, 4), m.nfe, m.nfce,
      m.total == null ? null : m.notas, m.total == null ? null : m.canceladas ?? null, m.total, m.variacao,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  meses.forEach((_, k) => {
    for (const c of [1, 2, 5]) {
      const cel = ws[XLSX.utils.encode_cell({ r: 4 + k, c })] as XLSX.CellObject | undefined;
      if (cel) cel.z = FORMATO_REAIS;
    }
  });
  ws['!cols'] = [{ wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 8 }, { wch: 11 }, { wch: 16 }, { wch: 13 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Faturamento');
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

/** Uma comparação do detalhamento: o mês de referência, o valor dele e a diferença (em R$ e em %). */
export interface ComparacaoDoMes { competencia: string; total: number; diferenca: number; variacao: number | null }

export interface DetalheDoMes {
  mes: MesDoFaturamento;
  emAndamento: boolean;
  /** o valor médio de cada nota (sem as canceladas) */
  ticketMedio: number | null;
  /** o mês anterior com nota */
  anterior: ComparacaoDoMes | null;
  /** o mesmo mês do ano passado */
  anoPassado: ComparacaoDoMes | null;
  /** quanto o mês é do faturado no ano dele (de janeiro até hoje), em % */
  noAno: number | null;
}

const comparar = (total: number, m: MesDoFaturamento | undefined): ComparacaoDoMes | null =>
  m?.total == null ? null : { competencia: m.competencia, total: m.total, diferenca: centavos(total - m.total), variacao: m.total > 0 ? Math.round(((total - m.total) / m.total) * 1000) / 10 : null };

/** O detalhamento de um mês (o clique na tabela ou no gráfico); null se o mês não está na lista. */
export function detalheDoMes(meses: readonly MesDoFaturamento[], competencia: string, hoje: Date): DetalheDoMes | null {
  const mes = meses.find(m => m.competencia === competencia);
  if (!mes) return null;
  const atual = hoje.getFullYear() + '-' + dois(hoje.getMonth() + 1);
  const total = mes.total;
  const antes = meses.filter(m => m.competencia < competencia && m.total != null).sort((a, b) => b.competencia.localeCompare(a.competencia))[0];
  const ano = competencia.slice(0, 4);
  const doAno = somaDos(meses.filter(m => m.competencia.startsWith(ano + '-') && m.competencia <= atual));
  return {
    mes, emAndamento: competencia === atual,
    ticketMedio: total != null && mes.notas > 0 ? centavos(total / mes.notas) : null,
    anterior: total == null ? null : comparar(total, antes),
    anoPassado: total == null ? null : comparar(total, meses.find(m => m.competencia === (Number(ano) - 1) + competencia.slice(4))),
    noAno: total != null && doAno > 0 ? Math.round((total / doAno) * 1000) / 10 : null,
  };
}
