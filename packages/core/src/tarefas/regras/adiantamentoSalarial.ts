// O Adiantamento salarial (Vitor, 16/10/2026: "vai ter as provisões que ficam credoras e o lançamento para fazer a baixa é
// todo dia 15, se for útil; caso não seja, é pago antes ainda"). No razão da conta (Ativo), a folha do mês desconta o
// adiantamento a crédito (a provisão) e o pagamento do adiantamento entra a débito no dia 15 (ou no dia útil antes): o mês
// tem de zerar. O que falta pagar vira o lançamento sugerido: D Adiantamento salarial, C o banco, no dia certo.
import { diaUtil } from '../../mandei';
import { mesesDoRazao, type RazaoDaConta } from './razao';

const centavos = (n: number) => Math.round(n * 100) / 100;
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

/** O dia do pagamento do adiantamento ('aaaa-mm' → 'aaaa-mm-dd'): o dia 15, ou o dia útil antes dele. */
export function dataDoAdiantamentoSalarial(mes: string, dia = 15): string {
  const [a, m] = mes.split('-').map(Number);
  let d = new Date(a, m - 1, dia);
  while (!diaUtil(d)) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  return iso(d);
}

export interface MesDoAdiantamentoSalarial {
  mes: string;
  /** o descontado na folha do mês (os créditos) */
  provisao: number;
  /** os pagamentos do mês (os débitos), com a data */
  pagamentos: { data: string; valor: number }[];
  /** o dia em que o pagamento devia estar */
  dataEsperada: string;
  /** o saldo do fim do mês (positivo = credor, como o razão); tem de zerar */
  saldoFinal: number;
  /** o que falta pagar no mês (a provisão menos os pagamentos; 0 = nada) */
  falta: number;
}

/** O razão do Adiantamento salarial mês a mês: a provisão, os pagamentos, o dia certo, o saldo e o que falta. */
export function conferirAdiantamentoSalarial(razao: RazaoDaConta, meses: readonly string[]): MesDoAdiantamentoSalarial[] {
  return mesesDoRazao(razao, meses).map(m => {
    const provisao = centavos(m.lancamentos.filter(l => l.valor > 0).reduce((s, l) => s + l.valor, 0));
    const pagamentos = m.lancamentos.filter(l => l.valor < 0).map(l => ({ data: l.data, valor: centavos(-l.valor) }));
    const pago = centavos(pagamentos.reduce((s, p) => s + p.valor, 0));
    return { mes: m.mes, provisao, pagamentos, dataEsperada: dataDoAdiantamentoSalarial(m.mes), saldoFinal: centavos(m.saldoFinal), falta: Math.max(0, centavos(provisao - pago)) };
  });
}

const mesBR = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);
export const historicoDoAdiantamentoSalarial = (mes: string) => 'Pagamento de adiantamento salarial ' + mesBR(mes);
