import { describe, expect, it } from 'vitest';
import { lerData } from './texto';
import { extratoDoPdf, type ItemDeTexto } from './extrato';

// o BB "Extrato de Conta Corrente" (16/11/2026: "no extrato puxa o 6 pra baixo"): a linha do fim da página sai com a data
// cortada ("16/01/202") e o "6" cai na coluna Dia da página seguinte, antes do primeiro lançamento. Valores inventados.
const linha = (y: number, partes: [string, number][]): ItemDeTexto[] => partes.map(([texto, x]) => ({ texto, x, y, largura: texto.length * 4.5 }));
const cabecalho = (y: number) => [
  ...linha(y + 40, [['Extrato de Conta Corrente', 120]]),
  ...linha(y + 25, [['Agência: 0001-9', 250], ['Conta: 12345-6', 330]]),
  ...linha(y + 12, [['Lançamentos', 40]]),
  ...linha(y, [['Dia', 40], ['Lote', 100], ['Documento', 160], ['Histórico', 300], ['Valor', 520]]),
];
const pagina1 = [
  ...cabecalho(700),
  ...linha(680, [['31/12/2025', 40], ['Saldo Anterior', 300], ['1.000,00', 500], ['(+)', 545]]),
  ...linha(660, [['15/01/2026', 40], ['14397', 100], ['150722312363571', 160], ['Pix - Recebido', 300], ['5,88', 515], ['(+)', 545]]),
  ...linha(652, [['15/01 07:22 CLIENTE EXEMPLO', 300]]),
  ...linha(640, [['00/00/0000', 40], ['14397', 100], ['Saldo do dia', 300], ['0,00', 515], ['(+)', 545]]),
  ...linha(620, [['16/01/202', 40], ['14397', 100], ['160951224516231', 160], ['Pix - Recebido', 300], ['1.384,00', 500], ['(+)', 545]]),
];
const pagina2 = [
  ...cabecalho(700),
  ...linha(690, [['16/01 09:51 OUTRO CLIENTE', 300]]),
  ...linha(681, [['6', 40]]),
  ...linha(660, [['16/01/2026', 40], ['14397', 100], ['161041288764932', 160], ['Pix - Recebido', 300], ['3,48', 515], ['(+)', 545]]),
];

describe('o ano cortado na virada da página (o BB, 16/11/2026)', () => {
  it('o "6" da página seguinte volta para a data: o lançamento fica no dia certo', () => {
    const r = extratoDoPdf([pagina1, pagina2], 'banco', 2026);
    expect(r.lancamentos.map(l => [l.data, l.valor])).toEqual([['2026-01-15', 588], ['2026-01-16', 138400], ['2026-01-16', 348]]);
    // e o "6" não vai parar no histórico do lançamento de baixo
    expect(r.lancamentos[2].historico).not.toMatch(/(^|\s)6(\s|$)/);
  });
  it('sem a página seguinte, o ano cortado que começa igual ao do extrato vale como ele', () => {
    expect(lerData('16/01/202', 2026)).toBe('2026-01-16');
    expect(lerData('16/01/201', 2026)).toBeNull();
    expect(lerData('16/01/26', 2026)).toBe('2026-01-16');
  });
});
