// A etapa Empréstimos e financiamentos (Vitor, 07/10/2026: "monte uma tela para o usuário upar os razões e selecionar o
// banco daquele empréstimo"): um razão por contrato, cada um com o banco dele. O banco já vem sugerido pelo próprio razão
// (a contrapartida das parcelas é a conta contábil do banco no Cadastro). A conta é do passivo: fica credora ou zera.
import type { LancamentoDoRazao, RazaoDaConta, MesDoRazao } from './razao';

/** Um banco da empresa no Cadastro, com a conta contábil dele (ex.: 10503). */
export interface BancoDoEmprestimo { id: string; nome: string; contaContabil?: string }

/**
 * O banco do empréstimo pelo razão: a conta contábil do banco que mais aparece de contrapartida (as parcelas pagas e o
 * crédito do empréstimo). null = nenhuma contrapartida é conta de banco do Cadastro.
 */
export function bancoDoRazao(r: RazaoDaConta, bancos: readonly BancoDoEmprestimo[]): string | null {
  const conta = new Map(bancos.filter(b => b.contaContabil).map(b => [b.contaContabil as string, b.id]));
  const vezes = new Map<string, number>();
  for (const l of r.lancamentos) {
    const id = conta.get(l.contrapartida.trim());
    if (id) vezes.set(id, (vezes.get(id) || 0) + 1);
  }
  return [...vezes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Os meses que fecham devedor (o saldo do fim do mês negativo no Alterdata): empréstimo é passivo, fica credor ou zera. */
export function mesesDevedores(meses: readonly MesDoRazao[]): string[] {
  return meses.filter(m => m.saldoFinal < -0.005).map(m => m.mes);
}

// ─── Os contratos dentro do razão (Vitor, 07/10/2026: "dá pra pegar o número dos empréstimos pelo razão?") ──────────
// Uma conta de empréstimos costuma ter vários contratos, um atrás do outro. O número vem no histórico, de vários jeitos:
// "CCB n° 01098198", "Contrato 1246082", "doc. 1563830 Capital de Giro", "01802448 DÉB.EMPRÉSTIMO".

/** O número do contrato no histórico: 5 a 9 dígitos soltos (datas e parcelas "05/12" não contam), sem os zeros da frente. */
export function numeroDoContrato(historico: string): string | null {
  const limpo = historico.replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, ' ');
  const m = limpo.match(/(?<![\d.,])\d{5,9}(?![\d.,])/);
  return m ? String(Number(m[0])) : null;
}

export interface ContratoDoRazao {
  numero: string;
  /** 'aaaa-mm-dd' do primeiro e do último lançamento */
  inicio: string;
  fim: string;
  /** a liberação (os créditos que não são encargo nem estorno) */
  liberado: number;
  liberadoEm: string;
  /** os meses com pagamento (débito) e o total de parcelas, quando o histórico diz ("parc. 01/12", "12 parcelas") */
  pagas: number;
  parcelas: number | null;
  /** a soma dos lançamentos do contrato (positivo = credor: o que falta pagar) */
  saldo: number;
  /** pagou todas as parcelas e ainda tem saldo: lançamento com o número errado, ou parcela que faltou */
  quitadoComSaldo: boolean;
  /** os lançamentos sem número zeram este contrato (a implantação de saldo, parcelas com "?"): eles são dele */
  completadoSemNumero: boolean;
  lancamentos: LancamentoDoRazao[];
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Os contratos do razão, até o fim do período (ate = 'aaaa-mm'; sem = tudo), na ordem em que começaram, e os lançamentos
 * sem número (a implantação de saldo, histórico incompleto).
 */
export function contratosDoRazao(r: RazaoDaConta, ate?: string): { contratos: ContratoDoRazao[]; semNumero: LancamentoDoRazao[]; somaSemNumero: number } {
  const ls = ate ? r.lancamentos.filter(l => l.data.slice(0, 7) <= ate) : r.lancamentos;
  const porNumero = new Map<string, LancamentoDoRazao[]>();
  const semNumero: LancamentoDoRazao[] = [];
  for (const l of ls) {
    const n = numeroDoContrato(l.historico);
    if (n) porNumero.set(n, [...(porNumero.get(n) || []), l]);
    else semNumero.push(l);
  }
  const contratos = [...porNumero].map(([numero, lc]) => {
    const liberacoes = lc.filter(l => l.valor > 0 && !/encargo|juro|estorno|ajuste/i.test(l.historico));
    const total = lc.map(l => l.historico.match(/(?:parc\.?\s*)?\d{1,2}\/(\d{2})\b|(\d{1,2})\s*parcelas/i)).find(m => m);
    const parcelas = total ? Number(total[1] || total[2]) : null;
    const pagas = new Set(lc.filter(l => l.valor < 0).map(l => l.data.slice(0, 7))).size;
    const saldo = centavos(lc.reduce((s, l) => s + l.valor, 0));
    return {
      numero, inicio: lc[0].data, fim: lc[lc.length - 1].data,
      liberado: centavos(liberacoes.reduce((s, l) => s + l.valor, 0)), liberadoEm: liberacoes[0]?.data || '',
      pagas, parcelas, saldo,
      quitadoComSaldo: parcelas != null && pagas >= parcelas && Math.abs(saldo) >= 0.01,
      completadoSemNumero: false,
      lancamentos: lc,
    };
  }).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const somaSemNumero = centavos(semNumero.reduce((s, l) => s + l.valor, 0));
  // os sem número que zeram exatamente um contrato são dele (o 901149 da 292: implantação de 2020 e parcelas "?")
  const dono = semNumero.length ? contratos.filter(k => Math.abs(k.saldo + somaSemNumero) < 0.01 && Math.abs(k.saldo) >= 0.01) : [];
  return {
    contratos: contratos.map(k => ({ ...k, completadoSemNumero: dono.length === 1 && dono[0] === k })),
    semNumero, somaSemNumero,
  };
}

// ─── Os empréstimos guardados no Cadastro (Vitor, 07/10/2026: "o usuário deixando selecionado aqui, você já adiciona nas
// outras competências, de acordo com o razão, quando e qual empréstimo entra até a competência consultada") ───────────

/** O que vai para o Cadastro de cada contrato do razão: o banco escolhido e os meses em que ele valeu (quitado: até o fim). */
export function emprestimosParaOCadastro(contratos: readonly ContratoDoRazao[], banco: string): { numero: string; banco: string; desde: string; ate?: string }[] {
  return contratos.map(k => {
    const quitado = Math.abs(k.saldo) < 0.01 || k.completadoSemNumero;
    return { numero: k.numero, banco, desde: (k.liberadoEm || k.inicio).slice(0, 7), ...(quitado ? { ate: k.fim.slice(0, 7) } : {}) };
  });
}

/** Os empréstimos do Cadastro que valem no período ('aaaa-mm', em ordem): começaram até o fim e não acabaram antes do início. */
export function emprestimosNoPeriodo<T extends { desde: string; ate?: string }>(cadastrados: readonly T[], meses: readonly string[]): T[] {
  if (!meses.length) return [];
  const [ini, fim] = [meses[0], meses[meses.length - 1]];
  return cadastrados.filter(e => e.desde <= fim && (!e.ate || e.ate >= ini));
}

/** O banco do razão pelos contratos já guardados (o que mais aparece); null = nenhum contrato dele está no Cadastro. */
export function bancoPelosContratos(contratos: readonly { numero: string }[], cadastrados: readonly { numero: string; banco: string }[]): string | null {
  const vezes = new Map<string, number>();
  for (const k of contratos) {
    const b = cadastrados.find(e => e.numero === k.numero)?.banco;
    if (b) vezes.set(b, (vezes.get(b) || 0) + 1);
  }
  return [...vezes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
