import { describe, expect, it } from 'vitest';
import { extratoDoPdf, type ItemDeTexto } from './extrato';

// a data centrada na linha de duas alturas (16/11/2026: "Datas ou mês errados"; o BB imprime a data no meio da altura do
// histórico de duas linhas, uns 4 pontos abaixo do valor). Posições e valores inventados.
const linha = (y: number, partes: [string, number][]): ItemDeTexto[] => partes.map(([texto, x]) => ({ texto, x, y, largura: texto.length * 4.5 }));

const pagina = [
  ...linha(700, [['Extrato', 40], ['de', 80], ['conta', 95], ['corrente', 125]]),
  ...linha(660, [['Dia', 40], ['Lote', 100], ['Documento', 140], ['Histórico', 230], ['Valor', 480]]),
  ...linha(645, [['31/12/2025', 40], ['Saldo Anterior', 230], ['1.000,00', 470], ['(+)', 515]]),
  // 15/01: uma linha só
  ...linha(630, [['15/01/2026', 40], ['13105', 100], ['10203', 140], ['Pagamento de Boleto', 230], ['200,00', 478], ['(-)', 515]]),
  // 16/01: o histórico em duas linhas e a data no meio delas (4,5 pontos abaixo do valor)
  ...linha(615, [['14397', 100], ['160951224516231', 140], ['Pix - Recebido', 230], ['1.384,00', 470], ['(+)', 515]]),
  ...linha(610.5, [['16/01/2026', 40]]),
  ...linha(606, [['16/01 10:16 FULANO DE TAL', 230]]),
  // 16/01 de novo, numa linha só
  ...linha(591, [['16/01/2026', 40], ['13113', 100], ['810160700024267', 140], ['Tarifa', 230], ['63,00', 482], ['(-)', 515]]),
  // 19/01: a data sozinha acima dos lançamentos do dia (fica com os de baixo)
  ...linha(570, [['19/01/2026', 40]]),
  ...linha(558, [['13105', 100], ['10205', 140], ['Pagamento de Boleto', 230], ['50,00', 482], ['(-)', 515]]),
];

describe('a data centrada na linha de duas alturas (16/11/2026)', () => {
  it('o valor fica com a data da própria linha, não com a do dia anterior', () => {
    const r = extratoDoPdf([pagina], 'banco', 2026);
    expect(r.lancamentos.map(l => [l.data, l.valor])).toEqual([
      ['2026-01-15', -20000], ['2026-01-16', 138400], ['2026-01-16', -6300], ['2026-01-19', -5000],
    ]);
  });
});
