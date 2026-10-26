import { describe, expect, it } from 'vitest';
import { lancamentosDoPdf, paginasPorMes, saldoAnteriorDoPdf, saldosDoDiaDoPdf, type ItemDeTexto } from './extrato';

const t = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 4.6 });

// O Sicoob do SISBR ("EXTRATO CONTA CORRENTE", a data sem o ano) nas posições do PDF de verdade (nomes e valores
// inventados): o valor das saídas, do saldo anterior e do saldo do dia 5 pontos acima da linha da data; a letra C/D 5 pontos
// abaixo (ou 11, quando o valor está na linha da data). A data em que o PDF foi tirado (27/07/2026) abre o cabeçalho.
const SISBR: ItemDeTexto[] = [
  t('27/07/2026', 115, 695), t('EXTRATO CONTA CORRENTE', 232, 695), t('09:33:14', 445, 695),
  t('PERÍODO:', 115, 659), t('01/06/2026 - 30/06/2026', 162, 659),
  t('DATA', 115, 625), t('HISTÓRICO', 154, 625), t('VALOR', 449, 625),
  t('1.000,00', 440, 613), t('29/05', 115, 608), t('SALDO ANTERIOR', 154, 608), t('C', 474, 603),
  t('29/05', 115, 591), t('SALDO BLOQ.ANTERIOR', 154, 591), t('0,00*', 459, 591),
  t('01/06', 115, 579), t('PIX RECEB.OUTRA IF', 154, 579), t('500,00C', 446, 579),
  t('Recebimento Pix', 154, 567), t('FULANO DE TAL', 154, 555),
  t('1.500,00', 440, 543), t('01/06', 115, 538), t('SALDO DO DIA', 154, 538), t('C', 474, 533),
  t('200,00', 445, 521), t('02/06', 115, 516), t('DB.TR.C.DIF.TIT.INT', 154, 516), t('D', 474, 511),
  t('FAV.: FORNECEDOR EXEMPLO', 154, 499),
  t('02/06', 115, 487), t('DB.CONV.TR FD-RFB', 154, 487), t('300,00', 445, 487), t('D', 474, 476),
  t('Pagto de Simples Nacional', 154, 465),
  t('1.000,00', 440, 453), t('02/06', 115, 448), t('SALDO DO DIA', 154, 448), t('C', 474, 443),
];

describe('o Sicoob do SISBR (Vitor, 26/10/2026: a 183 em junho)', () => {
  it('o valor e o C/D soltos vão para a linha da data: o saldo anterior e o do dia não viram lançamento, e as saídas saem com o valor delas', () => {
    expect(lancamentosDoPdf([SISBR], 'banco', 2026)).toEqual([
      { data: '2026-06-01', valor: 50000, historico: 'PIX RECEB.OUTRA IF Recebimento Pix FULANO DE TAL' },
      { data: '2026-06-02', valor: -20000, historico: 'DB.TR.C.DIF.TIT.INT FAV.: FORNECEDOR EXEMPLO' },
      { data: '2026-06-02', valor: -30000, historico: 'DB.CONV.TR FD-RFB Pagto de Simples Nacional' },
    ]);
  });
  it('o saldo anterior e os saldos do dia', () => {
    expect(saldoAnteriorDoPdf([SISBR])).toBe(100000);
    expect(saldosDoDiaDoPdf([SISBR], 2026)).toEqual([{ data: '2026-06-01', saldo: 150000 }, { data: '2026-06-02', saldo: 100000 }]);
  });
  it('a página vai para o mês do extrato, não para o mês em que o PDF foi tirado', () => {
    expect(paginasPorMes([SISBR], 2026)).toEqual({ '2026-06': [0] });
  });
});

// O Stone (do mais novo para o mais velho): "Saída" com "- R$ 95.000,00" e o rendimento de R$ 0,01 ao lado de outro de
// R$ 0,02 (a diferença dos saldos vizinhos não decide o sinal).
const STONE: ItemDeTexto[] = [
  t('Período: de 01/07/2026 a 31/07/2026', 20, 614),
  t('DATA', 26, 590), t('TIPO', 80, 590), t('DESCRIÇÃO', 125, 590), t('VALOR', 275, 590), t('SALDO', 355, 590),
  t('Fulano de Tal', 125, 571), t('31/07/26', 26, 565), t('Saída', 80, 565), t('- R$ 95.000,00', 275, 565), t('R$ 174.067,89', 355, 565), t('Transferência | TED', 125, 559),
  t('Recebimento vendas', 125, 535), t('31/07/26', 26, 529), t('Entrada', 80, 529), t('R$ 96,67', 275, 529), t('R$ 269.067,89', 355, 529), t('Mastercard | Crédito', 125, 523),
  t('Rendimento automático', 125, 498), t('31/07/26', 26, 492), t('Entrada', 80, 492), t('R$ 0,02', 275, 492), t('R$ 268.971,22', 355, 492), t('Rendimento', 125, 486),
  t('Rendimento automático', 125, 461), t('30/07/26', 26, 455), t('Entrada', 80, 455), t('R$ 0,01', 275, 455), t('R$ 268.971,20', 355, 455), t('Rendimento', 125, 449),
  t('Tarifa', 125, 424), t('30/07/26', 26, 418), t('Saída', 80, 418), t('- R$ 1,22', 275, 418), t('R$ 268.971,19', 355, 418),
];

describe('o Stone (Vitor, 26/10/2026: a 183)', () => {
  it('o "- R$" é o sinal; do mais novo para o mais velho, a diferença dos saldos não troca o rendimento de centavos', () => {
    expect(lancamentosDoPdf([STONE], 'banco', 2026).map(l => [l.data, l.valor])).toEqual([
      ['2026-07-31', -9500000], ['2026-07-31', 9667], ['2026-07-31', 2], ['2026-07-30', 1], ['2026-07-30', -122],
    ]);
  });
});
