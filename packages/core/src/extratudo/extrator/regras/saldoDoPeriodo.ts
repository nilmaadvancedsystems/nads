// O saldo da conta banco no período: o extrato × o razão, dia a dia e no fim (Vitor, 05/10/2026: a etapa Exclusão do
// Creditor — depois de importar o .xls do Creditor no Alterdata e excluir o lançamento do total, a pessoa reimporta o
// razão do banco e o nads confere se o saldo bate no período). O razão não traz saldo de abertura: ele começa do mesmo
// saldo anterior do extrato e anda com o próprio movimento. O cheque especial do razão (ajuste e estorno, que não
// estão no extrato) fica de fora, como na conferência do banco. Valores em centavos.
import type { EmpresaExtrator, LancamentoDoArquivo } from '../tipos';
import { arquivosDoBanco } from './bancos';
import { conferenciaDoBanco } from './situacaoDoBanco';
import { conferir } from './conferencia';
import { movimentoDoExtrato } from './movimento';

/** Um dia em que o saldo do razão não bate com o do extrato. */
export interface DiaDoSaldo { data: string; extrato: number; razao: number; diferenca: number }

export interface SaldoDoPeriodo {
  /** tem extrato e razão no período */
  completo: boolean;
  /** o saldo do extrato no fim do período */
  extrato: number;
  /** o saldo do razão no fim do período (do mesmo saldo anterior) */
  razao: number;
  bate: boolean;
  /** os dias em que o saldo (acumulado) não bate, em ordem */
  dias: DiaDoSaldo[];
}

export function saldoDoPeriodo(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): SaldoDoPeriodo {
  const ms = [...new Set(meses)].sort();
  const vazio = { completo: false, extrato: 0, razao: 0, bate: false, dias: [] };
  if (!ms.length) return vazio;
  const doMes = (lado: 'banco' | 'sistema', mes: string): LancamentoDoArquivo[] =>
    arquivosDoBanco(e, banco, primeiro, lado, mes).flatMap(a =>
      a.lancamentos.flatMap((l, i) => (l.data.startsWith(mes) ? [{ ...l, id: a.id + ':' + i, idArquivo: a.id, lado }] : [])));
  const extrato = ms.flatMap(m => doMes('banco', m));
  const razaoBruto = ms.flatMap(m => doMes('sistema', m));
  if (!extrato.length || !razaoBruto.length) return vazio;
  // o cheque especial do razão fica de fora (as mesmas linhas que a conferência do banco tira)
  const cheque = new Set([...conferenciaDoBanco(e, banco, primeiro, ms, semMovimento).cheque.linhas].map(l => l.id));
  const razao = razaoBruto.filter(l => !cheque.has(l.id));
  // o razão com o sinal ao contrário do extrato (débito/crédito): vira
  const sinal = conferir(extrato, razao).sistemaInvertido ? -1 : 1;
  const mov = movimentoDoExtrato(e, banco, primeiro, ms[0], ms[ms.length - 1]);
  const porDia = (ls: readonly LancamentoDoArquivo[], s: number) => {
    const m = new Map<string, number>();
    for (const l of ls) m.set(l.data, (m.get(l.data) || 0) + s * l.valor);
    return m;
  };
  const doExtrato = porDia(extrato, 1), doRazao = porDia(razao, sinal);
  const datas = [...new Set([...doExtrato.keys(), ...doRazao.keys()])].sort();
  let saldoE = mov.saldoAnterior, saldoR = mov.saldoAnterior;
  const dias: DiaDoSaldo[] = [];
  for (const d of datas) {
    saldoE += doExtrato.get(d) || 0;
    saldoR += doRazao.get(d) || 0;
    if (saldoE !== saldoR) dias.push({ data: d, extrato: saldoE, razao: saldoR, diferenca: saldoR - saldoE });
  }
  return { completo: true, extrato: saldoE, razao: saldoR, bate: saldoE === saldoR, dias };
}
