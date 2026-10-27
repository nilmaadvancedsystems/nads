// O Adiantamento salarial (Vitor, 16/10/2026: "vai ter as provisões que ficam credoras e o lançamento para fazer a baixa é
// todo dia 15, se for útil; caso não seja, é pago antes ainda"). No razão da conta (Ativo), a folha do mês desconta o
// adiantamento a crédito (a provisão) e o pagamento do adiantamento entra a débito no dia 15 (ou no dia útil antes): o mês
// tem de zerar. O que falta pagar vira o lançamento sugerido: D Adiantamento salarial, C o banco, no dia certo.
import { diaUtil } from '../../mandei';
import { mesesDoRazao, naOrdemDasDatas, type RazaoDaConta } from './razao';

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

/** Um pagamento que falta: o mês do desconto, o dia do pagamento (o 15 dele), o valor e o histórico. */
export interface PagamentoQueFalta { mes: string; data: string; valor: number; historico: string }

/**
 * O que falta pagar para o adiantamento zerar (Vitor, 26/10/2026: "dia 31/01/2026 ficou R$ 4.146,50, quero que gere um
 * lançamento dia 15 para zerar ele"): cada desconto na folha é pago no dia 15 do mesmo mês. Os pagamentos do razão abatem os
 * descontos mais antigos primeiro (o pago com atraso conta para o mês dele); o saldo credor de antes do razão entra no
 * primeiro mês. O que sobra de cada mês, até `ateMes`, é o lançamento sugerido — também de mês antes dos da etapa, que é
 * de onde vem o saldo que não zera.
 */
export function pagamentosQueFaltam(razao: RazaoDaConta, ateMes: string): PagamentoQueFalta[] {
  const r = naOrdemDasDatas(razao);
  if (!r.lancamentos.length) return [];
  // todos os meses do razão até o último da etapa (o pagamento do dia 15 vem antes do desconto do fim do mês: o mês a mês)
  const meses: string[] = [];
  for (let m = r.lancamentos[0].data.slice(0, 7); m <= ateMes; m = proximoMes(m)) meses.push(m);
  const abertos: { mes: string; valor: number }[] = [];
  if (r.saldoInicial > 0.005) abertos.push({ mes: meses[0], valor: centavos(r.saldoInicial) });
  // o pago a mais (o saldo devedor de antes, o pagamento maior que os descontos): abate os próximos descontos
  let sobra = r.saldoInicial < -0.005 ? centavos(-r.saldoInicial) : 0;
  for (const m of mesesDoRazao(r, meses)) {
    const desconto = centavos(m.lancamentos.filter(l => l.valor > 0).reduce((x, l) => x + l.valor, 0));
    let pago = centavos(sobra + m.lancamentos.filter(l => l.valor < 0).reduce((x, l) => x - l.valor, 0));
    // o pagamento do mês paga primeiro o desconto do mês; o que sobra, os meses mais antigos
    const doMes = Math.min(pago, desconto);
    pago = centavos(pago - doMes);
    // o que sobra com o valor de um mês em aberto é dele (o pago com atraso); senão, paga os mais antigos
    const igual = abertos.findIndex(x => Math.abs(x.valor - pago) <= 0.01);
    if (igual >= 0) { abertos.splice(igual, 1); pago = 0; }
    while (pago > 0.005 && abertos.length) {
      const a = abertos[0];
      const usa = Math.min(a.valor, pago);
      a.valor = centavos(a.valor - usa);
      pago = centavos(pago - usa);
      if (a.valor <= 0.005) abertos.shift();
    }
    sobra = pago;
    const resto = centavos(desconto - doMes);
    if (resto > 0.005) abertos.push({ mes: m.mes, valor: resto });
  }
  return abertos.map(a => ({ mes: a.mes, data: dataDoAdiantamentoSalarial(a.mes), valor: a.valor, historico: historicoDoAdiantamentoSalarial(a.mes) }));
}

const proximoMes = (m: string) => { const [a, x] = m.split('-').map(Number); return x === 12 ? (a + 1) + '-01' : a + '-' + String(x + 1).padStart(2, '0'); };

/** O razão do Adiantamento salarial mês a mês: a provisão, os pagamentos, o dia certo, o saldo e o que falta. */
export function conferirAdiantamentoSalarial(razao: RazaoDaConta, meses: readonly string[]): MesDoAdiantamentoSalarial[] {
  const faltam = meses.length ? pagamentosQueFaltam(razao, meses[meses.length - 1]) : [];
  return mesesDoRazao(razao, meses).map(m => {
    const provisao = centavos(m.lancamentos.filter(l => l.valor > 0).reduce((s, l) => s + l.valor, 0));
    const pagamentos = m.lancamentos.filter(l => l.valor < 0).map(l => ({ data: l.data, valor: centavos(-l.valor) }));
    const falta = faltam.find(p => p.mes === m.mes)?.valor || 0;
    return { mes: m.mes, provisao, pagamentos, dataEsperada: dataDoAdiantamentoSalarial(m.mes), saldoFinal: centavos(m.saldoFinal), falta };
  });
}

const mesBR = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);
export const historicoDoAdiantamentoSalarial = (mes: string) => 'Pagamento de adiantamento salarial ' + mesBR(mes);
