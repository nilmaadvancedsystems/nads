// Saldo de fechamento por dia.
// Origem: cheque_especial.html — buildDailyClosingBalances (~L612).
import type { Colunas, DiaSaldo } from '../tipos';
import { dataDaCelula } from './datas';
import { saldoDaCelula } from './saldo';

/**
 * Um saldo por dia, em ordem de data. Linhas sem data ou sem saldo válidos são puladas;
 * havendo várias linhas no mesmo dia, vale a ÚLTIMA (o relatório vem em ordem cronológica).
 */
export function saldosDeFechamento(linhas: unknown[][], cols: Colunas, inverterCD: boolean): DiaSaldo[] {
  const porDia = new Map<number, DiaSaldo>();
  for (let r = cols.linhaCabecalho + 1; r < linhas.length; r++) {
    const linha = linhas[r];
    if (!linha) continue;
    const data = dataDaCelula(linha[cols.colData]);
    const saldo = saldoDaCelula(linha[cols.colSaldo], inverterCD);
    if (data == null || saldo == null) continue;
    porDia.set(data.getTime(), { data, saldo });
  }
  return [...porDia.values()].sort((a, b) => a.data.getTime() - b.data.getTime());
}
