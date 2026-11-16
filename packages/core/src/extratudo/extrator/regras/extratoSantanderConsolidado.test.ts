import { describe, expect, it } from 'vitest';
import { extratoDoPdf, type ItemDeTexto } from './extrato';

// o "Extrato Consolidado" do Santander (16/11/2026, na 429), com as posições de verdade do PDF e valores inventados: a
// movimentação (Data 34, Descrição 65, Nº Documento 294, Créditos ~380, Débitos ~430, Saldo ~509, o negativo com o "-" no fim)
// e, no fim, o quadro "Saldos por Período" (uma linha por dia: o dia, o saldo, os bloqueios, a provisão e o saldo disponível)
const linha = (y: number, partes: [string, number][]): ItemDeTexto[] => partes.map(([texto, x]) => ({ texto, x, y, largura: texto.length * 4.5 }));

const pagina = [
  ...linha(815, [['EXTRATO CONSOLIDADO', 466]]),
  ...linha(806, [['março/2026', 511]]),
  ...linha(309, [['Movimentação', 34]]),
  ...linha(287, [['Data', 34], ['Descrição', 65], ['Nº Documento', 294], ['Movimentos (R$)', 389], ['Saldo (R$)', 508]]),
  ...linha(276, [['Créditos', 384], ['Débitos', 435]]),
  ...linha(266, [['SALDO EM 28/02', 65], ['1.000,00-', 509]]),
  ...linha(256, [['02/03', 34], ['PAGAMENTO CARTAO DE DEBITO', 65], ['111111', 308]]),
  ...linha(255, [['500,00', 380]]),
  ...linha(247, [['GETNET-VISA', 65]]),
  ...linha(237, [['PIX ENVIADO', 65], ['-', 318], ['200,00-', 428], ['700,00-', 509]]),
  ...linha(228, [['FORNECEDOR EXEMPLO', 65]]),
  ...linha(210, [['03/03', 34], ['TARIFA AVULSA ENVIO PIX', 65], ['-', 318], ['10,00-', 441], ['710,00-', 509]]),
  ...linha(200, [['SALDO EM 31/03', 65], ['710,00-', 509]]),
  ...linha(150, [['Saldos por Período', 34]]),
  ...linha(137, [['Dia', 34], ['Saldo', 98], ['Saldo', 170], ['Saldo', 241], ['Saldo', 312], ['Provisão', 374], ['Saldo de', 445], ['Saldo', 525]]),
  ...linha(120, [['02', 34], ['700,00-', 87], ['0,00', 174], ['0,00', 245], ['0,00', 316], ['50,00', 374], ['0,00', 458], ['700,00-', 512]]),
  ...linha(110, [['03', 34], ['710,00-', 87], ['0,00', 174], ['0,00', 245], ['0,00', 316], ['55,00', 374], ['0,00', 458], ['710,00-', 512]]),
];

describe('o Extrato Consolidado do Santander (16/11/2026, na 429)', () => {
  it('o quadro "Saldos por Período" do fim não vira lançamento, e a leitura fecha com o saldo do banco', () => {
    const r = extratoDoPdf([pagina], 'banco', 2026);
    expect(r.lancamentos.map(l => [l.data, l.valor])).toEqual([['2026-03-02', 50000], ['2026-03-02', -20000], ['2026-03-03', -1000]]);
    expect(r.conferenciaPeloSaldo?.naoFecham ?? 0).toBe(0);
  });
});
