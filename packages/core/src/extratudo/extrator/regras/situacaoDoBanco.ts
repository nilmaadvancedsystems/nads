// A situação de um banco no período (a linha do banco na Importação da Tarefas), no mês ou nos meses do Em Lote:
//   pendente     — falta extrato ou razão de algum mês com movimento, ou o extrato e o razão não batem;
//   falta-cheque — batem, mas o extrato fecha negativo em algum dia e o razão ainda não tem o cheque especial
//                  daquele dia (Vitor, 01/10/2026: "ao invés de Ok, coloca um Conferido; faz o cheque especial");
//   ok           — batem e, nos dias negativos, o razão tem o cheque especial (o ajuste no dia e o estorno depois).
// O cheque especial (a ferramenta Cheque especial: cheque-especial/regras/lancamentos.ts) lança, em cada dia que fecha
// negativo, o Ajuste (o valor do saldo negativo, no próprio dia) e o Estorno (o mesmo valor, ao contrário, no próximo dia
// do relatório). No razão novo, esses lançamentos não estão no extrato: a conferência os acha entre as sobras do razão e
// tira da conta — o saldo final confere ignorando o cheque especial.
import { normalizarTexto } from '../../../formatos';
import type { EmpresaExtrator, LancamentoDoArquivo, LinhaConferencia } from '../tipos';
import { arquivosDoBanco } from './bancos';
import { conferir } from './conferencia';
import { movimentoDoExtrato } from './movimento';

/** Um dia que fecha negativo no extrato (saldo em centavos, negativo). */
export interface DiaNegativo { data: string; saldo: number }

/** Até quantos dias depois do ajuste o estorno do cheque especial pode vir (o próximo dia do relatório). */
const DIAS_ATE_O_ESTORNO = 7;

const diaDe = (d: string) => { const [a, m, dd] = d.split('-').map(Number); return Date.UTC(a, m - 1, dd) / 86400000; };

/**
 * Os dias que fecham negativos no extrato da conta, no período: o saldo do último lançamento do dia, pela data com que o
 * lançamento entra no razão (no BB "Consultas", a Dt. movimento). É o saldo do razão: o saldo que o banco imprime vai
 * pela Dt. balancete e não serve (Vitor, 13/10/2026: na 380 o razão fecha 02/01 com 0,10 negativo, e o banco imprime
 * 276,31 positivo).
 */
export function diasNegativos(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[]): DiaNegativo[] {
  const ms = meses.slice().sort();
  if (!ms.length) return [];
  const fim = new Map<string, number>();
  for (const l of movimentoDoExtrato(e, banco, primeiro, ms[0], ms[ms.length - 1]).linhas) {
    if (ms.includes(l.data.slice(0, 7))) fim.set(l.data, l.saldo);
  }
  return [...fim].filter(([, s]) => s < 0).map(([data, saldo]) => ({ data, saldo })).sort((a, b) => a.data.localeCompare(b.data));
}

/** O cheque especial achado no razão: as linhas dele (para tirar da conferência) e os dias negativos que ele cobre. */
export interface ChequeNoRazao { linhas: Set<LancamentoDoArquivo>; cobertos: Set<string> }

/**
 * Entre as sobras do razão, o ajuste de cada dia negativo (o valor do saldo negativo, no próprio dia) e o estorno dele
 * (o mesmo valor, sinal contrário, até 7 dias depois). O último dia negativo do período pode ficar sem o estorno (a
 * ferramenta projeta o estorno para depois do relatório).
 */
export function chequeEspecialNoRazao(negativos: readonly DiaNegativo[], sobras: readonly LancamentoDoArquivo[], ultimoDia: string): ChequeNoRazao {
  const linhas = new Set<LancamentoDoArquivo>();
  const cobertos = new Set<string>();
  for (const n of negativos) {
    const v = Math.abs(n.saldo);
    const ajuste = sobras.find(l => !linhas.has(l) && l.data === n.data && Math.abs(l.valor) === v);
    if (!ajuste) continue;
    const estorno = sobras.find(l => !linhas.has(l) && l !== ajuste && Math.abs(l.valor) === v && Math.sign(l.valor) === -Math.sign(ajuste.valor)
      && diaDe(l.data) > diaDe(n.data) && diaDe(l.data) - diaDe(n.data) <= DIAS_ATE_O_ESTORNO);
    const projetado = !estorno && diaDe(ultimoDia) - diaDe(n.data) <= DIAS_ATE_O_ESTORNO;
    if (!estorno && !projetado) continue;
    linhas.add(ajuste);
    if (estorno) linhas.add(estorno);
    cobertos.add(n.data);
  }
  return { linhas, cobertos };
}

export interface ConferenciaDoBanco {
  /** todo mês com movimento tem o extrato e o razão */
  completo: boolean;
  /** o que não bateu em cada mês (já sem as linhas do cheque especial) */
  pendencias: { mes: string; linhas: LinhaConferencia[] }[];
  negativos: DiaNegativo[];
  /** os dias negativos que ainda não têm o cheque especial no razão */
  faltamCheque: DiaNegativo[];
  /** o cheque especial achado no razão */
  cheque: ChequeNoRazao;
  /** o "Ajuste de exercícios anteriores" do razão que bate com o saldo do extrato naquele dia: fica de fora */
  ajustes: Set<LancamentoDoArquivo>;
}

/** O lançamento que implanta o saldo da conta no razão: "Ajuste de exercício(s) anterior(es)". */
export function ehAjusteDeExerciciosAnteriores(historico: string): boolean {
  return /\bajustes? (?:de |do |dos )?exercicios? anterior(?:es)?\b/.test(normalizarTexto(historico));
}

/** A conferência do banco no período: mês a mês, extrato × razão, tirando o cheque especial do razão. */
export function conferenciaDoBanco(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): ConferenciaDoBanco {
  const comMovimento = meses.filter(m => !semMovimento.includes(m)).slice().sort();
  const doMes = (lado: 'banco' | 'sistema', mes: string): LancamentoDoArquivo[] =>
    arquivosDoBanco(e, banco, primeiro, lado, mes).flatMap(a =>
      a.lancamentos.flatMap((l, i) => (l.data.startsWith(mes) ? [{ ...l, id: a.id + ':' + i, idArquivo: a.id, lado }] : [])));
  let completo = comMovimento.length > 0;
  const porMes: { mes: string; linhas: LinhaConferencia[] }[] = [];
  for (const mes of comMovimento) {
    const extrato = doMes('banco', mes), razao = doMes('sistema', mes);
    if (!extrato.length || !razao.length) { completo = false; continue; }
    porMes.push({ mes, linhas: conferir(extrato, razao).linhas.filter(l => l.situacao !== 'ok') });
  }
  const negativos = completo ? diasNegativos(e, banco, primeiro, comMovimento) : [];
  const sobras = porMes.flatMap(p => p.linhas.filter(l => l.situacao === 'amais' && l.sistema).map(l => l.sistema as LancamentoDoArquivo));
  const ultimoDia = comMovimento.length ? ultimoDiaDoMes(comMovimento[comMovimento.length - 1]) : '';
  const cheque = negativos.length ? chequeEspecialNoRazao(negativos, sobras, ultimoDia) : { linhas: new Set<LancamentoDoArquivo>(), cobertos: new Set<string>() };
  // o cheque especial do fim do ano anterior, lançado no razão no começo de janeiro (até o dia 5): conta como certo
  // (Vitor, 13/10/2026: "quando vira de ano, eu jogo no começo de janeiro")
  for (const l of sobras) if (chequeDaViradaDoAno(l)) cheque.linhas.add(l);
  // o mesmo padrão em qualquer banco e começo de período (Vitor, 13/10/2026: "em todos os bancos de todas as empresas"):
  // o extrato abre negativo (o dia anterior ao período fechou negativo) e o razão, que começa em zero, traz nos 5
  // primeiros dias o estorno do cheque especial daquele dia, com o mesmo valor: conta como certo
  const inicio = comMovimento[0];
  const aberturaNegativa = inicio ? movimentoDoExtrato(e, banco, primeiro, inicio, inicio).saldoAnterior : 0;
  if (inicio && aberturaNegativa < 0) {
    const estorno = sobras.find(l => !cheque.linhas.has(l) && l.data.startsWith(inicio) && Number(l.data.slice(8, 10)) <= 5 && Math.abs(l.valor) === -aberturaNegativa);
    if (estorno) cheque.linhas.add(estorno);
  }
  // o "Ajuste de exercicio anteriores" que implanta o saldo da conta no razão (só no razão): fica de fora desde que o valor
  // seja o saldo do extrato antes daquele dia (Vitor, 26/10/2026: "desde que o saldo bata, ignore")
  const ajustes = new Set<LancamentoDoArquivo>();
  for (const l of sobras) {
    if (cheque.linhas.has(l) || !ehAjusteDeExerciciosAnteriores(l.historico)) continue;
    const mov = movimentoDoExtrato(e, banco, primeiro, l.data.slice(0, 7));
    // sem o saldo de abertura do extrato, não dá para saber se bate: fica como pendência
    if (mov.abertura == null) continue;
    const saldoAntes = mov.saldoAnterior + mov.linhas.filter(x => x.data < l.data).reduce((t, x) => t + x.valor, 0);
    if (Math.abs(l.valor) === Math.abs(saldoAntes)) ajustes.add(l);
  }
  // o par de cheque especial que se anula no razão (o ajuste e o estorno do mesmo valor, até 7 dias depois) sem um dia
  // negativo do mesmo valor no banco: não mexe no saldo, conta como certo (Vitor, 27/10/2026: na 237, o de 25.716,57 em
  // 30 e 31/03 aparecia como pendência — "já foi feito o cheque especial")
  // (o par pode estar antes ou depois, e a outra metade já contar como cheque: o ajuste de 1º a 5 de janeiro entra pela
  // virada do ano, e o estorno dele, no dia 6, ficava sozinho)
  const pareados = new Set<LancamentoDoArquivo>();
  for (const l of [...sobras].sort((a, b) => a.data.localeCompare(b.data))) {
    if (cheque.linhas.has(l) || !ehDoChequeEspecial(l)) continue;
    const par = sobras.find(m => m !== l && !pareados.has(m) && (!cheque.linhas.has(m) || chequeDaViradaDoAno(m)) && ehDoChequeEspecial(m) && m.valor === -l.valor
      && m.data !== l.data && Math.abs(diaDe(m.data) - diaDe(l.data)) <= DIAS_ATE_O_ESTORNO);
    if (par) { cheque.linhas.add(l); cheque.linhas.add(par); pareados.add(l); pareados.add(par); }
  }
  const pendencias = porMes
    .map(p => ({ mes: p.mes, linhas: p.linhas.filter(l => !(l.situacao === 'amais' && l.sistema && (cheque.linhas.has(l.sistema) || ajustes.has(l.sistema)))) }))
    .filter(p => p.linhas.length > 0);
  return { completo, pendencias, negativos, faltamCheque: negativos.filter(n => !cheque.cobertos.has(n.data)), cheque, ajustes };
}

/** O lançamento do cheque especial no razão: o histórico (ou o nome da contrapartida) diz "cheque especial", ou o código 92029. */
function ehDoChequeEspecial(l: Pick<LancamentoDoArquivo, 'historico' | 'complemento'>): boolean {
  return /\bcheque especial\b/.test(normalizarTexto(l.historico + ' ' + (l.complemento || ''))) || /\b92029\b/.test(l.historico);
}

/** O lançamento do cheque especial (o histórico diz "cheque especial" ou o código 92029) entre 1º e 5 de janeiro. */
export function chequeDaViradaDoAno(l: Pick<LancamentoDoArquivo, 'data' | 'historico'>): boolean {
  return /-01-0[1-5]$/.test(l.data) && (/\bcheque especial\b/.test(normalizarTexto(l.historico)) || /\b92029\b/.test(l.historico));
}

function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return mes + '-' + String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0');
}

export type SituacaoDoBanco =
  | { tipo: 'pendente' }
  | { tipo: 'falta-cheque'; negativos: DiaNegativo[]; faltam: DiaNegativo[] }
  | { tipo: 'ok'; negativos: DiaNegativo[] };

export function situacaoDoBancoNoPeriodo(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): SituacaoDoBanco {
  const c = conferenciaDoBanco(e, banco, primeiro, meses, semMovimento);
  if (!c.completo || c.pendencias.length) return { tipo: 'pendente' };
  if (c.faltamCheque.length) return { tipo: 'falta-cheque', negativos: c.negativos, faltam: c.faltamCheque };
  return { tipo: 'ok', negativos: c.negativos };
}

/**
 * O banco está Ok no período (Vitor, 01/10/2026): todo mês com movimento tem o extrato e o razão, eles batem entre si
 * (cada lançamento com a mesma data e o mesmo valor do outro lado) e, nos dias que fecham negativos, o cheque especial
 * está no razão. Os meses "sem movimento" ficam de fora; só com eles, não está Ok.
 */
export function bancoOkNoPeriodo(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): boolean {
  return situacaoDoBancoNoPeriodo(e, banco, primeiro, meses, semMovimento).tipo === 'ok';
}
