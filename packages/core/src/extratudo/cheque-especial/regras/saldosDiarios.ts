// Saldo de fechamento por dia.
// Origem: cheque_especial.html — buildDailyClosingBalances (~L612).
import type { Colunas, DiaSaldo } from '../tipos';
import { dataDaCelula } from './datas';
import { saldoDaCelula } from './saldo';

/**
 * Um saldo por dia, em ordem de data. Linhas sem data ou sem saldo válidos são puladas;
 * havendo várias linhas no mesmo dia, vale a ÚLTIMA (o relatório vem em ordem cronológica). No relatório do mais novo para
 * o mais velho (mais descidas que subidas), a última do dia é a primeira que aparece.
 */
export function saldosDeFechamento(linhas: unknown[][], cols: Colunas, inverterCD: boolean): DiaSaldo[] {
  const validas: DiaSaldo[] = [];
  for (let r = cols.linhaCabecalho + 1; r < linhas.length; r++) {
    const linha = linhas[r];
    if (!linha) continue;
    const data = dataDaCelula(linha[cols.colData]);
    const saldo = saldoDaCelula(linha[cols.colSaldo], inverterCD);
    if (data == null || saldo == null) continue;
    validas.push({ data, saldo });
  }
  let sobe = 0, desce = 0;
  validas.forEach((d, i) => {
    if (!i) return;
    const antes = validas[i - 1].data.getTime(), agora = d.data.getTime();
    if (agora > antes) sobe++;
    else if (agora < antes) desce++;
  });
  const porDia = new Map<number, DiaSaldo>();
  for (const d of desce > sobe ? validas.slice().reverse() : validas) porDia.set(d.data.getTime(), d);
  return [...porDia.values()].sort((a, b) => a.data.getTime() - b.data.getTime());
}
