// Casos tirados da auditoria dos extratos gravados (09/11/2026), com o layout real e valores trocados: cada um quebrava a
// cadeia "saldo anterior + movimento = saldo anterior do mês seguinte".
import { describe, expect, it } from 'vitest';
import { extratoDoPdf, saldoAnteriorDoPdf, type ItemDeTexto } from './extrato';

const pagina = (linhas: [string, number][][]): ItemDeTexto[] => linhas.flatMap((l, i) => l.map(([texto, x]) => ({ texto, x, y: 800 - i * 14, largura: texto.length * 5 })));

describe('o saldo anterior do extrato', () => {
  it('o resumo numa linha só (Saldo inicial, Entradas, Saídas, Saldo final): vale o inicial, não o final (o da direita)', () => {
    const p = pagina([
      [['Saldo inicial:', 40], ['R$', 110], ['1.500,25', 125], ['Entradas:', 190], ['R$', 240], ['800,00', 255], ['Saídas:', 310], ['R$', 350], ['-300,10', 365], ['Saldo final:', 420], ['R$', 480], ['2.000,15', 495]],
      [['Data', 40], ['Descrição', 100], ['Valor', 380], ['Saldo', 480]],
      [['05-01-2026', 40], ['PIX RECEBIDO', 100], ['800,00', 380], ['2.300,25', 480]],
      [['06-01-2026', 40], ['PIX ENVIADO', 100], ['-300,10', 380], ['2.000,15', 480]],
    ]);
    expect(saldoAnteriorDoPdf([p])).toBe(150025);
    expect(extratoDoPdf([p], 'banco', 2026).lancamentos.map(l => l.valor)).toEqual([80000, -30010]);
  });
  it('o saldo inicial negativo no resumo mantém o sinal', () => {
    const p = pagina([[['Saldo inicial:', 40], ['R$', 110], ['-50,00', 125], ['Entradas:', 190], ['R$', 240], ['10,00', 255], ['Saldo final:', 420], ['R$', 480], ['-40,00', 495]]]);
    expect(saldoAnteriorDoPdf([p])).toBe(-5000);
  });
  it('a linha com o saldo na coluna Valor e 0,00 na coluna Saldo (Caixa): vale o saldo, não o zero', () => {
    const p = pagina([[['30/05/2026', 40], ['SALDO ANTERIOR', 180], ['889,94 C', 420], ['0,00 C', 500]]]);
    expect(saldoAnteriorDoPdf([p])).toBe(88994);
    const separado = pagina([[['SALDO ANTERIOR', 180], ['889,94', 420], ['D', 455], ['0,00', 500], ['C', 525]]]);
    expect(saldoAnteriorDoPdf([separado])).toBe(-88994);
  });
  it('o saldo anterior zero de verdade continua zero', () => {
    expect(saldoAnteriorDoPdf([pagina([[['SALDO ANTERIOR', 180], ['0,00', 500]]])])).toBe(0);
    expect(saldoAnteriorDoPdf([pagina([[['SALDO ANTERIOR', 180], ['0,00 C', 420], ['0,00 C', 500]]])])).toBe(0);
  });
  it('a linha comum continua valendo o da direita, com o sinal', () => {
    expect(saldoAnteriorDoPdf([pagina([[['SALDO ANTERIOR', 100], ['12,00', 380], ['1.234,56', 480], ['D', 520]]])])).toBe(-123456);
    expect(saldoAnteriorDoPdf([pagina([[['SALDO ANTERIOR', 100], ['-R$', 470], ['30,00', 490]]])])).toBe(-3000);
  });
  it('o sinal do lançamento vem do saldo certo: a abertura do resumo não engana o primeiro lançamento', () => {
    const p = pagina([
      [['Data', 40], ['Histórico', 100], ['Valor', 380], ['Saldo', 480]],
      [['Saldo inicial:', 100], ['1.000,00', 200], ['Saldo final:', 300], ['900,00', 480]],
      [['05/01/2026', 40], ['OPERACAO', 100], ['100,00', 380], ['900,00', 480]],
    ]);
    expect(extratoDoPdf([p], 'banco', 2026).lancamentos.map(l => l.valor)).toEqual([-10000]);
  });
});
