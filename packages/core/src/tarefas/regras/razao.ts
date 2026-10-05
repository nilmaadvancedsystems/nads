// O razão de uma conta, exportado da conciliação do Alterdata (XLS): Status conciliação, Data, Lançamento automático,
// Contrapartida, Descrição (o nome da contrapartida), Valor, Histórico (o código), Descrição histórico, Saldo.
// Sinal do Alterdata: valor negativo = débito na conta; saldo negativo = devedor. Tudo no navegador.
import * as XLSX from 'xlsx';
import { brl, normalizarTexto, num } from '../../formatos';

export interface LancamentoDoRazao {
  /** AAAA-MM-DD */
  data: string;
  contrapartida: string;
  nomeContrapartida: string;
  /** negativo = débito na conta */
  valor: number;
  codigoHistorico: string;
  historico: string;
  /** negativo = devedor */
  saldo: number;
}

export interface RazaoDaConta {
  lancamentos: LancamentoDoRazao[];
  /** o saldo antes do primeiro lançamento (negativo = devedor) */
  saldoInicial: number;
  saldoFinal: number;
  /** AAAA-MM-DD do primeiro e do último lançamento */
  inicio: string;
  fim: string;
}

type Campo = 'data' | 'contrapartida' | 'nomeContrapartida' | 'valor' | 'codigoHistorico' | 'historico' | 'saldo';

const CAMPOS: Record<string, Campo> = {
  data: 'data', contrapartida: 'contrapartida', descricao: 'nomeContrapartida', valor: 'valor',
  historico: 'codigoHistorico', 'descricao historico': 'historico', saldo: 'saldo',
};

const centavos = (n: number) => Math.round(n * 100) / 100;

/** 46027 (data do Excel), Date ou "11/02/2026" → "2026-01-05"; o que não for data, ''. */
export function dataDoRazao(v: unknown): string {
  const dois = (n: number) => String(n).padStart(2, '0');
  if (v instanceof Date) return v.getFullYear() + '-' + dois(v.getMonth() + 1) + '-' + dois(v.getDate());
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? d.y + '-' + dois(d.m) + '-' + dois(d.d) : '';
  }
  const m = String(v ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + '-' + dois(+m[2]) + '-' + dois(+m[1]) : '';
}

/** As linhas da planilha (a primeira aba, valores crus) → o razão. Lança Error com a mensagem para a tela. */
export function lerRazao(linhas: unknown[][]): RazaoDaConta {
  const iCab = linhas.findIndex(l => {
    const cs = l.map(c => CAMPOS[normalizarTexto(c)]);
    return cs.includes('data') && cs.includes('valor') && cs.includes('saldo');
  });
  if (iCab < 0) throw new Error('Não achei as colunas do razão (Data, Valor e Saldo). Exporte o razão da conta pela conciliação do Alterdata.');
  const col: Partial<Record<Campo, number>> = {};
  linhas[iCab].forEach((c, i) => { const k = CAMPOS[normalizarTexto(c)]; if (k && col[k] == null) col[k] = i; });
  const texto = (l: unknown[], k: Campo) => (col[k] == null ? '' : String(l[col[k]!] ?? '').trim());
  const lancamentos: LancamentoDoRazao[] = [];
  for (const l of linhas.slice(iCab + 1)) {
    const data = dataDoRazao(l[col.data!]);
    const valor = num(l[col.valor!]);
    const saldo = num(l[col.saldo!]);
    if (!data || valor == null || saldo == null) continue;
    lancamentos.push({
      data, valor: centavos(valor), saldo: centavos(saldo),
      contrapartida: texto(l, 'contrapartida'), nomeContrapartida: texto(l, 'nomeContrapartida'),
      codigoHistorico: texto(l, 'codigoHistorico'), historico: texto(l, 'historico'),
    });
  }
  if (!lancamentos.length) throw new Error('O razão não tem nenhum lançamento.');
  const primeiro = lancamentos[0];
  const ultimo = lancamentos[lancamentos.length - 1];
  return { lancamentos, saldoInicial: centavos(primeiro.saldo - primeiro.valor), saldoFinal: ultimo.saldo, inicio: primeiro.data, fim: ultimo.data };
}

/** O arquivo (.xls, .xlsx, .ods) → o razão. */
export function lerRazaoDoArquivo(buf: ArrayBuffer): RazaoDaConta {
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: true }); }
  catch { throw new Error('Não consegui abrir o arquivo. Exporte o razão da conciliação do Alterdata em XLS.'); }
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba) throw new Error('A planilha não tem nenhuma aba.');
  return lerRazao(XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: true, defval: null, blankrows: false }));
}

/** -15,5 → "15,50 D"; 1.200 → "1.200,00 C"; 0 → "0,00" (débito/devedor é negativo no Alterdata). */
export function valorComLado(n: number): string {
  return n === 0 ? brl(0) : brl(Math.abs(n)) + (n < 0 ? ' D' : ' C');
}

// ─── O razão mês a mês (o Em lote: cada mês do período, como a Importação do banco) ──────────────────────────────────

export interface MesDoRazao {
  /** 'aaaa-mm' */
  mes: string;
  lancamentos: LancamentoDoRazao[];
  /** o saldo antes do primeiro lançamento do mês (o do fim do mês de antes) */
  saldoInicial: number;
  /** o saldo no fim do mês (sem lançamento no mês: o mesmo do começo) */
  saldoFinal: number;
  /** os dias (AAAA-MM-DD) em que o caixa fechou credor */
  diasCredor: string[];
}

/** Os meses pedidos (o período da etapa), cada um com os lançamentos dele e os saldos; o razão pode ter meses a mais. */
export function mesesDoRazao(r: RazaoDaConta, meses: readonly string[]): MesDoRazao[] {
  return meses.map(mes => {
    const lancamentos = r.lancamentos.filter(l => l.data.slice(0, 7) === mes);
    const antes = r.lancamentos.filter(l => l.data.slice(0, 7) < mes);
    const saldoInicial = antes.length ? antes[antes.length - 1].saldo : r.saldoInicial;
    // o saldo de cada dia é o do último lançamento dele; credor = positivo no Alterdata
    const fimDoDia = new Map<string, number>();
    for (const l of lancamentos) fimDoDia.set(l.data, l.saldo);
    const diasCredor = [...fimDoDia].filter(([, s]) => s > 0).map(([d]) => d);
    return { mes, lancamentos, saldoInicial, saldoFinal: lancamentos.length ? lancamentos[lancamentos.length - 1].saldo : saldoInicial, diasCredor };
  });
}

// ─── Pontos de atenção do caixa (Vitor, 05/10/2026) ───────────────────────────────────────────────────────────────────
// O que o banco pagou ou recebeu e foi parar no caixa. Só o CRÉD.LIQ.COBRANÇA obriga (a etapa Creditor entra no mês);
// o resto é aviso: a pessoa decide se corrige.

export type TipoDeAtencao = 'liquidacao-cobranca' | 'caixa-credor' | 'impostos-federais' | 'boletos' | 'impostos-orgaos';

export interface DescricaoDaAtencao { titulo: string; dica: string; obrigatorio: boolean }

/** Na ordem em que aparecem: o obrigatório primeiro, depois o caixa credor e os avisos do banco. */
export const ATENCOES_DO_CAIXA: Record<TipoDeAtencao, DescricaoDaAtencao> = {
  'liquidacao-cobranca': { titulo: 'Liquidação de cobrança no caixa (CRÉD.LIQ.COBRANÇA)', dica: 'Obrigatório: faça o Creditor (a etapa entrou na rotina do mês).', obrigatorio: true },
  'caixa-credor': { titulo: 'Caixa credor', dica: 'O caixa fechou credor nestes dias: procure pagamentos lançados no caixa que saíram pelo banco e vendas à vista que faltam.', obrigatorio: false },
  'impostos-federais': { titulo: 'Impostos federais no caixa (DB.CONV.TR FD-RFB)', dica: 'DARF pago pelo banco e lançado no caixa. Não é obrigatório corrigir.', obrigatorio: false },
  'impostos-orgaos': { titulo: 'Impostos no caixa (DÉB.CONV.ORGÃOS)', dica: 'Guias de órgãos do governo pagas pelo banco e lançadas no caixa. Não é obrigatório corrigir.', obrigatorio: false },
  boletos: { titulo: 'Boletos no caixa (DÉB. TIT.)', dica: 'Boletos pagos pelo banco e lançados no caixa. Não é obrigatório corrigir.', obrigatorio: false },
};

const ORDEM_DAS_ATENCOES = Object.keys(ATENCOES_DO_CAIXA) as TipoDeAtencao[];

/** O histórico do lançamento do banco → o ponto de atenção (null = nenhum). */
export function atencaoDoHistorico(historico: string): Exclude<TipoDeAtencao, 'caixa-credor'> | null {
  const h = historico.toUpperCase();
  if (/CR[ÉE]D\.?\s*LIQ\.?\s*COBRAN/.test(h)) return 'liquidacao-cobranca';
  if (/DB\.?\s*CONV\.?\s*TR\.?\s*FD-?\s*RFB/.test(h)) return 'impostos-federais';
  if (/D[ÉE]B\.?\s*CONV\.?\s*[ÓO]RG[ÃA]OS/.test(h)) return 'impostos-orgaos';
  if (/D[ÉE]B\.\s*TIT\./.test(h)) return 'boletos';
  return null;
}

export interface PontoDeAtencao extends DescricaoDaAtencao {
  tipo: TipoDeAtencao;
  /** os lançamentos que caíram nele (no caixa credor, o último de cada dia credor) */
  lancamentos: LancamentoDoRazao[];
  /** a soma dos valores; no caixa credor, o maior saldo credor */
  total: number;
}

/** Os pontos de atenção de um mês do razão, na ordem (só os que aparecem). */
export function atencoesDoMes(m: MesDoRazao): PontoDeAtencao[] {
  const grupos = new Map<TipoDeAtencao, LancamentoDoRazao[]>();
  const juntar = (tipo: TipoDeAtencao, l: LancamentoDoRazao) => grupos.set(tipo, [...(grupos.get(tipo) || []), l]);
  for (const l of m.lancamentos) {
    const tipo = atencaoDoHistorico(l.historico);
    if (tipo) juntar(tipo, l);
  }
  for (const dia of m.diasCredor) {
    const ultimo = m.lancamentos.filter(l => l.data === dia).pop();
    if (ultimo) juntar('caixa-credor', ultimo);
  }
  return ORDEM_DAS_ATENCOES.filter(tipo => grupos.has(tipo)).map(tipo => {
    const lancamentos = grupos.get(tipo)!;
    const total = tipo === 'caixa-credor' ? Math.max(...lancamentos.map(l => l.saldo)) : lancamentos.reduce((s, l) => s + Math.abs(l.valor), 0);
    return { tipo, ...ATENCOES_DO_CAIXA[tipo], lancamentos, total: centavos(total) };
  });
}

/** O mês precisa do Creditor (tem liquidação de cobrança no caixa)? */
export function precisaDoCreditor(m: MesDoRazao): boolean {
  return m.lancamentos.some(l => atencaoDoHistorico(l.historico) === 'liquidacao-cobranca');
}
