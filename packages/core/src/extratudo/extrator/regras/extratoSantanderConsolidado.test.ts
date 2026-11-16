import { describe, expect, it } from 'vitest';
import { anoDoTexto, extratoDoPdf, type ItemDeTexto } from './extrato';

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

// o mesmo extrato com o rodapé do modelo em toda página ("Extrato_PJ_A4_Basico - 2/4/2024") e o mês só no topo ("junho/2026"),
// as datas da movimentação sem o ano (Vitor, 16/11/2026: "tá bugado, é de junho/2026", e o nads dizia 06/2024)
const paginaDeJunho = (n: number): ItemDeTexto[] => [
  ...linha(815, [['EXTRATO CONSOLIDADO', 466]]),
  ...linha(806, [['junho/2026', 511]]),
  ...linha(309, [['Movimentação', 34]]),
  ...linha(287, [['Data', 34], ['Descrição', 65], ['Nº Documento', 294], ['Movimentos (R$)', 389], ['Saldo (R$)', 508]]),
  ...linha(276, [['Créditos', 384], ['Débitos', 435]]),
  ...(n === 1
    ? [...linha(266, [['SALDO EM 31/05', 65], ['1.000,00-', 509]]), ...linha(256, [['02/06', 34], ['GETNET-MAESTRO', 65], ['-', 318], ['300,00', 380], ['700,00-', 509]])]
    : [...linha(266, [['15/06', 34], ['TARIFA AVULSA ENVIO PIX', 65], ['-', 318], ['10,00-', 441], ['710,00-', 509]]), ...linha(256, [['SALDO EM 30/06', 65], ['710,00-', 509]])]),
  ...linha(20, [['Extrato_PJ_A4_Basico - 2/4/2024', 34], ['Pagina: ' + n + '/2', 500]]),
];

describe('o ano do Extrato Consolidado do Santander (16/11/2026)', () => {
  it('vem do mês do topo (junho/2026), e não da data do modelo no rodapé', () => {
    const r = extratoDoPdf([paginaDeJunho(1), paginaDeJunho(2)], 'banco', 2025);
    expect(r.lancamentos.map(l => [l.data, l.valor])).toEqual([['2026-06-02', 30000], ['2026-06-15', -1000]]);
  });

  it('o mês por extenso com a barra conta; a data do nome do modelo, não', () => {
    expect(anoDoTexto(['junho/2026', 'MAIO / 2026', ...Array<string>(3).fill('Extrato_PJ_A4_Basico - 2/4/2024')].join('\n'), 2025)).toBe(2026);
    expect(anoDoTexto('Período: 01/03/2026 a 31/03/2026', 2025)).toBe(2026);
  });
});
