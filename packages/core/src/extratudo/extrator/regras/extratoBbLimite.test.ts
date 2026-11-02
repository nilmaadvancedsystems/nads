import { describe, expect, it } from 'vitest';
import { lancamentosDoPdf, type ItemDeTexto } from './extrato';

const t = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 4.6 });

// o extrato do BB nas posições do PDF de verdade (valores inventados): o depósito bloqueado com o "*" solto e, depois do
// 999 S A L D O, o quadro da simulação do limite do cheque especial
const BB: ItemDeTexto[] = [
  t('Dt. balancete', 60, 640), t('Dt. movimento Ag. origem Lote Histórico', 118, 640), t('Documento', 408, 640), t('Valor R$', 472, 640), t('Saldo', 525, 640),
  t('31/03/2026', 65, 629), t('0000', 191, 629), t('00000 000 Saldo Anterior', 224, 629), t('1.000,00 C', 507, 629),
  t('01/04/2026', 65, 617), t('2705', 191, 617), t('15354 511 Depósito bloquead.1d útil', 224, 617), t('1.637.700.319', 401, 617), t('7.098,54 *', 468, 617),
  t('01/04/2026', 65, 605), t('2705', 191, 605), t('99031 830 Dep CORBAN dinheiro', 224, 605), t('27.057.992.000.006', 380, 605), t('2.000,00 C', 465, 605),
  t('30/04/2026', 65, 267), t('0000', 192, 267), t('13601 123 Cobrança de Juros', 225, 267), t('511.057.727', 410, 267), t('54,13 D', 475, 267),
  t('30/04/2026', 65, 255), t('0000', 192, 255), t('00000 999 S A L D O', 225, 255), t('2.945,87 C', 523, 255),
  t('- Limite Ouro Empresarial', 56, 234), t('14.500,00C', 505, 234),
  t('Custo Efetivo Total-CET ao Mês', 56, 191), t('15,43', 527, 191),
  t('Custo Efetivo Total-CET ao Ano', 56, 180), t('472,83', 523, 180),
  t('Informações Complementares - CET (*)', 56, 148), t('R$', 459, 148),
  t('Valor total devido', 56, 137), t('16.736,77', 433, 137),
  t('Valor liberado', 56, 126), t('14.500,00', 433, 126), t('99,46', 553, 126),
  t('Despesas vinculadas', 56, 115),
  t('- Tributos IOF', 56, 104), t('90,77', 449, 104), t('0,54', 558, 104),
  t('- Tarifa', 56, 92), t('2.146,00', 438, 92), t('0,00', 558, 92),
];

describe('o extrato do BB (Vitor, 26/10/2026: a 237 com pendências "mesmo batendo tudo")', () => {
  it('o depósito bloqueado (o "*" solto) e o quadro da simulação do limite não são lançamento', () => {
    expect(lancamentosDoPdf([BB], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([['2026-04-01', 200000], ['2026-04-30', -5413]]);
  });
});
