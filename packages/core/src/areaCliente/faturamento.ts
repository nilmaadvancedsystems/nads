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
  /** o que entrou nas contas da empresa no mês, pelos extratos que o escritório leu (13/11/2026: "comparação com os
   *  extratos bancários"); sem o campo, o mês não tem extrato */
  banco?: { entradas: number; /** o que saiu das contas no mês (13/11/2026: "mais informações do banco") */ saidas?: number; contas: number;
    /** a soma dos saldos de fim de mês das contas, quando todas trazem (a data é a mais nova) */ saldo?: { valor: number; data: string }; /** cada conta, a maior primeiro (13/11/2026: "subseleção por banco") */ porBanco?: EntradaDoBanco[] };
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

// ---------------------------------------------------------------------------------------------------------------------
// O faturado contra o que entrou no banco (13/11/2026: "no faturamento quero que tenha comparação com os extratos
// bancários"). As entradas são os créditos dos extratos lidos pelo escritório, de todas as contas da empresa no mês: entram
// também transferências entre as contas, empréstimos e aportes, então a diferença é um sinal, não uma conta exata.

/** O que entrou numa conta no mês: o id da conta no Extrator, o nome, a marca (o logo) e o valor. */
export interface EntradaDoBanco {
  id: string; nome: string; marca?: string; entradas: number; saidas?: number;
  /** o saldo no último dia do mês que o extrato imprime (13/11/2026: "saldo atual"), com a data 'aaaa-mm-dd' */
  saldo?: { valor: number; data: string };
}

export interface MesNoBanco { competencia: string; faturado: number | null; entradas: number | null; contas: number }
export interface FaturadoXBanco {
  /** o mês escolhido */
  mes: MesNoBanco & {
    /** entradas − faturado */
    diferenca: number | null;
    /** quanto do faturado entrou no banco, em % */
    cobertura: number | null;
    /** a leitura em português do mês */
    leitura: string;
    tom: 'bom' | 'atencao' | 'neutro';
  };
  /** os últimos 6 meses com algum dos dois (o mais velho primeiro), para o gráfico lado a lado */
  serie: MesNoBanco[];
  /** algum mês tem extrato */
  temBanco: boolean;
}

/** As contas que aparecem nos meses (para a escolha do banco), a que mais recebeu primeiro. */
export function bancosDoFaturamento(meses: readonly MesDoFaturamento[]): { id: string; nome: string; marca?: string }[] {
  const soma = new Map<string, { id: string; nome: string; marca?: string; total: number }>();
  for (const m of meses) for (const b of m.banco?.porBanco ?? []) {
    const x = soma.get(b.id) ?? { id: b.id, nome: b.nome, ...(b.marca ? { marca: b.marca } : {}), total: 0 };
    x.total += b.entradas;
    soma.set(b.id, x);
  }
  return [...soma.values()].sort((a, b) => b.total - a.total).map(({ total: _t, ...b }) => b);
}

/** A comparação do mês escolhido e a série dos 6 meses até ele; com um banco escolhido, só o que entrou nele. */
export function faturadoXBanco(meses: readonly MesDoFaturamento[], competencia: string, banco?: string): FaturadoXBanco {
  const entradasDo = (m: MesDoFaturamento | undefined): number | null => {
    if (!m?.banco) return null;
    if (!banco) return m.banco.entradas;
    return m.banco.porBanco?.find(b => b.id === banco)?.entradas ?? 0;
  };
  const doMes = (m: MesDoFaturamento | undefined, c: string): MesNoBanco =>
    ({ competencia: c, faturado: m?.total ?? null, entradas: entradasDo(m), contas: banco ? (m?.banco ? 1 : 0) : m?.banco?.contas ?? 0 });
  const porMes = new Map(meses.map(m => [m.competencia, m]));
  // a série é sempre a dos últimos 6 meses com dado (13/11/2026: "o gráfico indo para trás infinito tá estranho"): o mês
  // escolhido só fica destacado nela, não muda a janela
  const serieFixa = () => [...porMes.keys()].sort().map(c => doMes(porMes.get(c), c)).filter(m => m.faturado != null || m.entradas != null).slice(-6);
  const base = doMes(porMes.get(competencia), competencia);
  const diferenca = base.faturado != null && base.entradas != null ? centavos(base.entradas - base.faturado) : null;
  const cobertura = base.faturado != null && base.faturado > 0 && base.entradas != null ? Math.round((base.entradas / base.faturado) * 1000) / 10 : null;
  let leitura: string, tom: FaturadoXBanco['mes']['tom'] = 'neutro';
  const doMesTodo = porMes.get(competencia)?.banco;
  if (banco && base.entradas != null && doMesTodo) {
    const nome = doMesTodo.porBanco?.find(b => b.id === banco)?.nome ?? 'Esta conta';
    const parte = doMesTodo.entradas > 0 ? Math.round((base.entradas / doMesTodo.entradas) * 1000) / 10 : 0;
    const fb = faturadoXBanco(meses, competencia);
    return { mes: { ...base, diferenca, cobertura, leitura: nome + ' recebeu ' + String(parte).replace('.', ',') + '% do que entrou nas contas no mês.', tom: 'neutro' },
      serie: serieFixa(),
      temBanco: fb.temBanco };
  }
  if (base.entradas == null) leitura = 'O escritório ainda não leu os extratos deste mês.';
  else if (base.faturado == null || base.faturado === 0) leitura = 'Entrou dinheiro no banco, mas o mês não tem nota emitida.';
  else if (cobertura != null && cobertura >= 90 && cobertura <= 115) { leitura = 'O que entrou no banco acompanha o faturado.'; tom = 'bom'; }
  else if (cobertura != null && cobertura < 90) { leitura = 'Entrou menos do que o faturado: vendas a prazo, cartão a receber ou pagamento em dinheiro.'; tom = 'atencao'; }
  else { leitura = 'Entrou mais do que o faturado: pode ser recebimento de meses anteriores, transferência entre contas ou empréstimo.'; tom = 'atencao'; }
  const serie = serieFixa();
  return { mes: { ...base, diferenca, cobertura, leitura, tom }, serie, temBanco: meses.some(m => m.banco) };
}

/** Um arquivo lido pelo Extrator (conferencia-nilma, extrator/{empresa}/arquivos): só o que esta conta precisa. */
export interface ArquivoDoExtrato {
  lado?: string; banco?: string; lancamentos?: readonly { data?: string; valor?: number; historico?: string }[];
  /** o saldo que o extrato imprime no fim de cada dia (centavos), quando ele traz */
  saldosDoDia?: readonly { data?: string; saldo?: number }[];
}

/**
 * As entradas de cada mês pelos extratos (13/11/2026): a soma dos créditos (valor > 0, em centavos) dos arquivos do lado
 * do banco, em reais; o mesmo lançamento em dois arquivos (o mesmo banco, a data, o valor e o histórico) conta uma vez;
 * e quantas contas (bancos) tiveram extrato no mês.
 */
export function entradasDosExtratos(arquivos: readonly ArquivoDoExtrato[], bancos: readonly { id: string; nome?: string; marca?: string }[] = []): Record<string, { entradas: number; saidas: number; contas: number; saldo?: { valor: number; data: string }; porBanco: EntradaDoBanco[] }> {
  const vistos = new Set<string>();
  const soma = new Map<string, { centavos: number; saem: number; bancos: Set<string>; porBanco: Map<string, number>; saidasPorBanco: Map<string, number> }>();
  // sem o banco no arquivo, é o primeiro da empresa (arquivos de antes de ela ter mais de um)
  const primeiro = bancos[0]?.id ?? 'banco';
  const doBanco = new Map(bancos.map(b => [b.id, b]));
  const nomeDa = (id: string) => doBanco.get(id)?.nome || (id === 'banco' || id === 'conta' ? 'Conta' : id.split('-')[0].replace(/^./, x => x.toUpperCase()));
  // o saldo de cada conta no último dia de cada mês que o extrato imprime: '<banco>|<mês>' → { data, centavos }
  const saldos = new Map<string, { data: string; centavos: number }>();
  for (const a of arquivos) {
    if (a.lado !== 'banco') continue;
    const banco = a.banco || primeiro;
    for (const sd of a.saldosDoDia ?? []) {
      const mes = /^(\d{4}-\d{2})/.exec(sd.data ?? '')?.[1];
      if (!mes || typeof sd.saldo !== 'number' || !Number.isFinite(sd.saldo)) continue;
      const k = banco + '|' + mes, ja = saldos.get(k);
      if (!ja || (sd.data as string) >= ja.data) saldos.set(k, { data: sd.data as string, centavos: sd.saldo });
    }
  }
  for (const a of arquivos) {
    if (a.lado !== 'banco') continue;
    const banco = a.banco || primeiro;
    for (const l of a.lancamentos ?? []) {
      const mes = /^(\d{4}-\d{2})/.exec(l.data ?? '')?.[1];
      if (!mes || typeof l.valor !== 'number' || !Number.isFinite(l.valor)) continue;
      const chave = banco + '|' + l.data + '|' + l.valor + '|' + (l.historico ?? '');
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const m = soma.get(mes) ?? { centavos: 0, saem: 0, bancos: new Set<string>(), porBanco: new Map<string, number>(), saidasPorBanco: new Map<string, number>() };
      m.bancos.add(banco);
      if (!m.porBanco.has(banco)) m.porBanco.set(banco, 0);
      if (l.valor > 0) { m.centavos += l.valor; m.porBanco.set(banco, (m.porBanco.get(banco) ?? 0) + l.valor); }
      else if (l.valor < 0) { m.saem += -l.valor; m.saidasPorBanco.set(banco, (m.saidasPorBanco.get(banco) ?? 0) - l.valor); }
      soma.set(mes, m);
    }
  }
  return Object.fromEntries([...soma].map(([mes, m]) => {
    const porBanco: EntradaDoBanco[] = [...m.porBanco].sort((x, y) => y[1] - x[1]).map(([id, centavos]) => {
      const marca = doBanco.get(id)?.marca;
      const sd = saldos.get(id + '|' + mes);
      return { id, nome: nomeDa(id), ...(marca ? { marca } : {}), entradas: Math.round(centavos) / 100, saidas: Math.round(m.saidasPorBanco.get(id) ?? 0) / 100,
        ...(sd ? { saldo: { valor: Math.round(sd.centavos) / 100, data: sd.data } } : {}) };
    });
    // o saldo de todas as contas só quando todas trazem o delas
    const todas = porBanco.every(b => b.saldo);
    const saldo = todas && porBanco.length ? {
      valor: Math.round(porBanco.reduce((t, b) => t + (b.saldo?.valor ?? 0) * 100, 0)) / 100,
      data: porBanco.map(b => b.saldo?.data ?? '').sort().pop() ?? '',
    } : null;
    return [mes, { entradas: Math.round(m.centavos) / 100, saidas: Math.round(m.saem) / 100, contas: m.bancos.size, ...(saldo ? { saldo } : {}), porBanco }];
  }));
}

/** O faturamento com as entradas do banco em cada mês que tem extrato (o robô junta antes de gravar no espelho). */
export function comOBanco(fat: ResumoDoFaturamento, doBanco: (codigo: number) => Record<string, NonNullable<MesDoFaturamento['banco']>> | null): ResumoDoFaturamento {
  return {
    ...fat,
    empresas: fat.empresas.map(e => {
      const b = doBanco(e.codigo);
      return b ? { ...e, meses: e.meses.map(m => (b[m.competencia] ? { ...m, banco: b[m.competencia] } : m)) } : e;
    }),
  };
}

/** O movimento das contas no mês (13/11/2026: "quero mais informações do banco"): o que entrou, o que saiu e o que ficou,
 *  no total e em cada conta (com a parte dela nas entradas); null sem extrato no mês. */
export interface MovimentoDasContas {
  entradas: number; saidas: number | null; resultado: number | null;
  /** o saldo no fim do mês (o último que os extratos imprimem); null quando algum extrato não traz */
  saldo: { valor: number; data: string } | null;
  contas: { id: string; nome: string; marca?: string; entradas: number; saidas: number | null; resultado: number | null; parte: number; saldo: { valor: number; data: string } | null }[];
}
export function movimentoDasContas(meses: readonly MesDoFaturamento[], competencia: string): MovimentoDasContas | null {
  const b = meses.find(m => m.competencia === competencia)?.banco;
  if (!b) return null;
  const cent = (v: number) => Math.round(v * 100) / 100;
  return {
    entradas: b.entradas, saidas: b.saidas ?? null, resultado: b.saidas != null ? cent(b.entradas - b.saidas) : null, saldo: b.saldo ?? null,
    contas: (b.porBanco ?? []).map(x => ({ saldo: x.saldo ?? null,
      id: x.id, nome: x.nome, ...(x.marca ? { marca: x.marca } : {}), entradas: x.entradas, saidas: x.saidas ?? null,
      resultado: x.saidas != null ? cent(x.entradas - x.saidas) : null,
      parte: b.entradas > 0 ? Math.round((x.entradas / b.entradas) * 1000) / 10 : 0,
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Os lançamentos do mês (13/11/2026: "escolhendo um banco, os lançamentos do mês"): cada valor que entrou e saiu das
// contas no mês, como no extrato (o dia, o histórico, o valor com o sinal e a conta), sem repetir o mesmo lançamento.
// O robô grava um documento por empresa e mês (resumo/extrato-{código}-{mês}); a lista tem um teto para caber nele.

export const MAIOR_LISTA_DE_LANCAMENTOS = 2500;
export interface LancamentoDoCliente { dia: number; historico: string; /** em reais; negativo = saiu */ valor: number; /** o id da conta */ conta: string }

/** Os lançamentos de um mês, por dia (e na ordem do extrato dentro do dia); cortados = quantos passaram do teto. */
export function lancamentosDoMes(arquivos: readonly ArquivoDoExtrato[], mes: string, bancos: readonly { id: string }[] = []): { lancamentos: LancamentoDoCliente[]; cortados: number } {
  const primeiro = bancos[0]?.id ?? 'banco';
  const vistos = new Set<string>();
  const todos: (LancamentoDoCliente & { ordem: number })[] = [];
  let ordem = 0;
  for (const a of arquivos) {
    if (a.lado !== 'banco') continue;
    const conta = a.banco || primeiro;
    for (const l of a.lancamentos ?? []) {
      if (!(l.data ?? '').startsWith(mes + '-') || typeof l.valor !== 'number' || !Number.isFinite(l.valor) || l.valor === 0) continue;
      const chave = conta + '|' + l.data + '|' + l.valor + '|' + (l.historico ?? '');
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      todos.push({ dia: Number((l.data as string).slice(8, 10)) || 0, historico: (l.historico ?? '').replace(/\s+/g, ' ').trim().slice(0, 140), valor: l.valor / 100, conta, ordem: ordem++ });
    }
  }
  todos.sort((x, y) => x.dia - y.dia || x.ordem - y.ordem);
  const cortados = Math.max(0, todos.length - MAIOR_LISTA_DE_LANCAMENTOS);
  return { lancamentos: todos.slice(0, MAIOR_LISTA_DE_LANCAMENTOS).map(({ ordem: _o, ...l }) => l), cortados };
}
