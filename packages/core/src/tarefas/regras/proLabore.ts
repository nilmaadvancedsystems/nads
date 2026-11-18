// Os pagamentos do pró-labore para o razão zerar (Vitor, 14/10/2026: "eu queria importar os pagamentos para esse razão
// zerar, nessa etapa do pró-labore"). O razão do Pró-labore a pagar do Alterdata traz, por competência e sócio, o
// pró-labore a crédito e o INSS descontado a débito, os dois com "<mm/aaaa> NOME DO SÓCIO" no histórico:
//
//     Pelo valor de retirada pró-labore a pagar ?  <01/2026> CARLOS HUMBERTO …          3.242,00 C
//     Pelo valor de INSS a recolher descontado s/ retirada pró-labore  <01/2026> CARLOS …   356,62 D
//
// O que sobra de cada competência e sócio (o líquido) é o pagamento que falta: D Pró-labore a pagar, C a conta que a
// pessoa escolhe (o banco, o caixa), H "Pagamento de pro-labore mm/aaaa SÓCIO". Pagamento sem a competência no
// histórico abate as mais antigas; o saldo de antes do razão entra como a competência anterior à primeira.
import { diaUtil } from '../../mandei';
import type { RazaoDaConta } from './razao';
import { preencherHistorico, type ModelosDoHistorico } from './historicosDoContabil';

export interface PagamentoDoProLabore {
  /** 'aaaa-mm' */
  competencia: string;
  socio: string;
  /** o líquido que falta pagar (positivo) */
  valor: number;
  /** 'aaaa-mm-dd': o último dia da competência */
  data: string;
  historico: string;
  /** veio do saldo de antes do razão (sem os lançamentos para conferir) */
  doSaldoAnterior?: boolean;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const RE_REF = /<(\d{2})\/(\d{4})>\s*(.*)$/;
const RE_MES_SOLTO = /\b(\d{2})\/(\d{4})\b/;
const fimDoMes = (m: string) => m + '-' + String(new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate()).padStart(2, '0');
const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };
const mesBR = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);

/** O histórico do pagamento: "Pagamento de pro-labore 01/2026 CARLOS HUMBERTO VOLPONI RODRIGUES". */
/**
 * A data do pagamento do pró-labore: o n-ésimo dia útil (1º a 5º; padrão o 5º) do mês seguinte à competência
 * ('aaaa-mm' → 'dd/mm/aaaa'), sem sábado, domingo e feriado nacional (Vitor, 14/10/2026: "pró-labore paga até o 5º dia
 * útil do mês posterior"; "se vai ser no 1, 2, 3, 4 ou 5 dia útil de cada mês").
 */
export function dataDoPagamentoDoProLabore(competencia: string, diaUtilDoMes = 5): string {
  const n = Math.min(5, Math.max(1, Math.round(diaUtilDoMes) || 5));
  const [a, m] = competencia.split('-').map(Number);
  let d = new Date(a, m, 1); // o dia 1 do mês seguinte (o mês do Date começa em 0)
  for (let uteis = diaUtil(d) ? 1 : 0; uteis < n; ) {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    if (diaUtil(d)) uteis++;
  }
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

export const historicoDoPagamento = (competencia: string, socio: string, modelos?: ModelosDoHistorico) =>
  preencherHistorico('prolabore.pagamento', { ref: mesBR(competencia), socio }, modelos).trim();

/**
 * O que falta pagar de cada competência e sócio, da mais antiga para a mais nova (só o que sobra). As mesmas contas da grade dos
 * meses (mesesDoProLabore; Vitor, 18/11/2026: a grade dizia "tudo pago" e o Gerar montava 3 pagamentos):
 * - o pagamento com "<mm/aaaa> SÓCIO" é desse sócio na competência; com "mm/aaaa" no histórico (sem o sócio), da competência;
 *   o que sobra de um sócio na competência abate os outros da mesma competência (nome escrito diferente não fica sem abater);
 * - o pagamento sem competência abate as mais antigas (o saldo de antes do razão primeiro);
 * - ate ('aaaa-mm'): só até o fim do período (o razão vem até o mês seguinte por causa dos pagamentos; a provisão dele não entra).
 */
export function pagamentosDoProLabore(razao: RazaoDaConta, modelos?: ModelosDoHistorico, ate?: string): PagamentoDoProLabore[] {
  type Grupo = { competencia: string; socio: string; valor: number; anterior?: boolean };
  const grupos = new Map<string, Grupo>();
  const pagoNaComp = new Map<string, number>();
  let solto = 0;
  const de = (competencia: string, socio: string) => {
    const k = competencia + '|' + socio;
    let g = grupos.get(k);
    if (!g) { g = { competencia, socio, valor: 0 }; grupos.set(k, g); }
    return g;
  };
  for (const l of razao.lancamentos) {
    const m = RE_REF.exec(l.historico);
    if (m) {
      const g = de(m[2] + '-' + m[1], m[3].replace(/\s+/g, ' ').trim());
      g.valor = centavos(g.valor + l.valor);
      continue;
    }
    const mm = l.valor < 0 ? RE_MES_SOLTO.exec(l.historico) : null;
    if (mm) { const c = mm[2] + '-' + mm[1]; pagoNaComp.set(c, centavos((pagoNaComp.get(c) || 0) - l.valor)); continue; }
    solto = centavos(solto + l.valor);
  }
  // o que ficou negativo num sócio (o pagamento com o nome diferente) e o pago com o mês sem o sócio abatem a competência
  for (const g of grupos.values()) if (g.valor < -0.005) { pagoNaComp.set(g.competencia, centavos((pagoNaComp.get(g.competencia) || 0) - g.valor)); g.valor = 0; }
  const ordem = [...grupos.values()].sort((a, b) => a.competencia.localeCompare(b.competencia) || a.socio.localeCompare(b.socio));
  for (const [c, pago] of pagoNaComp) {
    let resta = pago;
    for (const g of ordem) {
      if (resta <= 0.005) break;
      if (g.competencia !== c || g.valor <= 0.005) continue;
      const usa = Math.min(g.valor, resta);
      g.valor = centavos(g.valor - usa);
      resta = centavos(resta - usa);
    }
    if (resta > 0.005) solto = centavos(solto - resta);   // pagou mais que a competência: o resto abate as mais antigas
  }
  // o saldo de antes do razão (credor = pró-labore que vinha sem pagar): a competência anterior, com o sócio mais comum
  if (razao.saldoInicial > 0.005 && ordem.length) {
    const conta = new Map<string, number>();
    for (const g of ordem) conta.set(g.socio, (conta.get(g.socio) || 0) + 1);
    const socio = [...conta].sort((a, b) => b[1] - a[1])[0][0];
    ordem.unshift({ competencia: mesAntes(ordem[0].competencia), socio, valor: centavos(razao.saldoInicial), anterior: true });
  }
  // o pagamento (ou crédito) sem a competência no histórico: abate as mais antigas
  for (const g of ordem) {
    if (solto >= -0.005) break;
    const usa = Math.min(g.valor, -solto);
    if (usa <= 0) continue;
    g.valor = centavos(g.valor - usa);
    solto = centavos(solto + usa);
  }
  return ordem.filter(g => g.valor > 0.005 && (!ate || g.anterior || g.competencia <= ate)).map(g => ({
    competencia: g.competencia, socio: g.socio, valor: g.valor, data: fimDoMes(g.competencia),
    historico: historicoDoPagamento(g.competencia, g.socio, modelos), ...(g.anterior ? { doSaldoAnterior: true } : {}),
  }));
}

/** A situação do pró-labore de uma competência (a grade dos meses da etapa). */
export type SituacaoDoProLabore = 'pago' | 'parcial' | 'falta' | 'sem';

export interface MesDoProLabore {
  /** 'aaaa-mm' */
  mes: string;
  /** o pró-labore lançado a crédito na competência (todos os sócios) */
  provisao: number;
  /** o INSS descontado (a débito, com a competência) */
  inss: number;
  /** provisão − INSS: o que tem de ser pago */
  liquido: number;
  /** o que foi pago desta competência (com a competência no histórico, ou o pagamento sem ela abatendo das mais antigas) */
  pago: number;
  /** o que ainda falta pagar (0 quando pago) */
  falta: number;
  situacao: SituacaoDoProLabore;
  /** as datas dos pagamentos ('aaaa-mm-dd') que caíram nesta competência */
  pagoEm: string[];
  /** o saldo da conta no fim do mês (coluna Saldo do razão; credor positivo = a pagar); null antes do razão */
  saldo: number | null;
}


/**
 * O pró-labore mês a mês (Vitor, 18/11/2026: "coloca um saldo mensal embaixo para eu ver quais pagamentos faltam... pago ou nao
 * pago"; "para depois decidir se quero gerar os lancamentos"): por competência, a provisão, o INSS descontado, o líquido, o que
 * foi pago e o que falta. O pagamento com "<mm/aaaa>" (ou "mm/aaaa") no histórico é da competência; sem ela, abate das mais
 * antigas (o saldo de antes do razão primeiro). Só os meses pedidos voltam, em ordem.
 */
export function mesesDoProLabore(razao: RazaoDaConta, meses: readonly string[]): { meses: MesDoProLabore[]; anterior: { valor: number; falta: number } } {
  const por = new Map<string, { provisao: number; inss: number; pago: number; pagoEm: string[] }>();
  const de = (m: string) => { let g = por.get(m); if (!g) { g = { provisao: 0, inss: 0, pago: 0, pagoEm: [] }; por.set(m, g); } return g; };
  const soltos: { valor: number; data: string }[] = [];
  for (const l of razao.lancamentos) {
    const ref = RE_REF.exec(l.historico);
    if (l.valor > 0) {
      // crédito: a provisão da competência (sem competência, um estorno de pagamento: devolve às mais antigas)
      if (ref) de(ref[2] + '-' + ref[1]).provisao = centavos(de(ref[2] + '-' + ref[1]).provisao + l.valor);
      else soltos.push({ valor: -l.valor, data: l.data });
      continue;
    }
    const pago = -l.valor;
    if (ref && /INSS/i.test(l.historico)) { const g = de(ref[2] + '-' + ref[1]); g.inss = centavos(g.inss + pago); continue; }
    const solto = ref ? null : RE_MES_SOLTO.exec(l.historico);
    const comp = ref ? ref[2] + '-' + ref[1] : solto ? solto[2] + '-' + solto[1] : '';
    if (comp && por.has(comp)) { const g = de(comp); g.pago = centavos(g.pago + pago); g.pagoEm.push(l.data); }
    else soltos.push({ valor: pago, data: l.data });
  }
  // o saldo de antes (credor = a pagar) e as competências, da mais antiga para a mais nova, recebem os pagamentos sem competência
  const anterior = { valor: centavos(Math.max(0, razao.saldoInicial)), pago: 0 };
  const ordem = [...por.keys()].sort();
  const faltaDe = (m: string) => { const g = por.get(m)!; return centavos(g.provisao - g.inss - g.pago); };
  for (const s of soltos) {
    let resta = s.valor;
    if (resta < 0) continue;
    const doAnterior = Math.min(resta, centavos(anterior.valor - anterior.pago));
    if (doAnterior > 0.005) { anterior.pago = centavos(anterior.pago + doAnterior); resta = centavos(resta - doAnterior); }
    for (const m of ordem) {
      if (resta <= 0.005) break;
      const f = faltaDe(m);
      if (f <= 0.005) continue;
      const usa = Math.min(f, resta);
      const g = por.get(m)!;
      g.pago = centavos(g.pago + usa);
      g.pagoEm.push(s.data);
      resta = centavos(resta - usa);
    }
  }
  const lancs = [...razao.lancamentos].sort((a, b) => a.data.localeCompare(b.data));
  const saldoNoFim = (m: string): number | null => {
    const fim = fimDoMes(m);
    if (!razao.inicio || fim < razao.inicio.slice(0, 7) + '-01') return null;
    let s: number | null = razao.saldoInicial;
    for (const l of lancs) { if (l.data > fim) break; s = l.saldo; }
    return s === null ? null : centavos(s);
  };
  return {
    meses: [...meses].sort().map(m => {
      const g = por.get(m) || { provisao: 0, inss: 0, pago: 0, pagoEm: [] };
      const liquido = centavos(g.provisao - g.inss);
      const falta = centavos(Math.max(0, liquido - g.pago));
      const situacao: SituacaoDoProLabore = liquido <= 0.005 ? 'sem' : falta <= 0.005 ? 'pago' : g.pago > 0.005 ? 'parcial' : 'falta';
      return { mes: m, provisao: g.provisao, inss: g.inss, liquido, pago: g.pago, falta, situacao, pagoEm: [...new Set(g.pagoEm)].sort(), saldo: saldoNoFim(m) };
    }),
    anterior: { valor: anterior.valor, falta: centavos(Math.max(0, anterior.valor - anterior.pago)) },
  };
}
