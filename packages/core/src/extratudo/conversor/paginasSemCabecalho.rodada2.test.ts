// 2ª rodada, revisão de regressões: a página sem o cabeçalho da tabela só é lida quando continua a tabela. Comunicado ou outra tabela
// (sem o sinal do BB, sem a coluna Saldo da Unicred) ficam de fora, como antes. Dados fictícios.
import { describe, expect, it } from 'vitest';
import { lancamentosDaCora, lancamentosDaUnicred, lancamentosDoBancoDoBrasil } from '.';

const t = (texto: string, x: number, y: number) => ({ texto, x, y, largura: texto.length * 5 });

describe('Banco do Brasil', () => {
  const cab = (y: number) => [t('Dia', 30, y), t('Lote', 99, y), t('Documento', 148, y), t('Histórico', 265, y), t('Valor', 550, y)];
  const linha = (dia: string, h: string, v: string, s: string, y: number) => [t(dia, 30, y), t('13105', 99, y), t(h, 265, y), t(v, 530, y), t(s, 562, y)];
  const p1 = [...cab(780), ...linha('02/01/2026', 'Pix A', '10,00', '(+)', 760)];

  it('outra tabela, sem o sinal, em página sem cabeçalho não inventa lançamento', () => {
    const p2 = [t('Demonstrativo de aplicações', 30, 780), t('15/01/2026', 30, 740), t('Aplicação RF', 265, 740), t('5.000,00', 530, 740)];
    expect(lancamentosDoBancoDoBrasil([p1, p2])).toEqual([{ data: '2026-01-02', valor: 1000, historico: 'Pix A' }]);
  });

  it('a página só de comunicado não vira o histórico do lançamento seguinte', () => {
    const p2 = [t('Comunicado importante aos clientes', 265, 700)];
    const p3 = [...cab(780), ...linha('03/01/2026', 'Pix B', '20,00', '(-)', 760)];
    expect(lancamentosDoBancoDoBrasil([p1, p2, p3]).map(l => l.historico)).toEqual(['Pix A', 'Pix B']);
  });

  it('a continuação de verdade, com o sinal, segue lida', () => {
    const p2 = linha('03/01/2026', 'Pix B', '20,00', '(-)', 760);
    expect(lancamentosDoBancoDoBrasil([p1, p2]).map(l => l.valor)).toEqual([1000, -2000]);
  });
});

describe('Unicred', () => {
  const cab = (y: number) => [t('Data', 21, y), t('Lançamentos', 91, y), t('Valor', 396, y), t('(R$)', 424, y), t('Saldo', 514, y), t('(R$)', 543, y)];
  const linha = (dia: string, h: string, v: string, y: number) => [t(dia, 21, y), t(h, 91, y), t(v, 392, y), t('600,00', 509, y)];
  const p1 = [...cab(650), ...linha('02/01/2026', 'A', '10,00', 620)];

  it('outra tabela, sem a coluna Saldo, em página sem cabeçalho não inventa lançamento', () => {
    const p2 = [t('Parcelas a vencer', 21, 700), t('15/02/2026', 21, 680), t('Empréstimo', 91, 680), t('1.234,56', 392, 680)];
    expect(lancamentosDaUnicred([p1, p2]).map(l => l.valor)).toEqual([1000]);
  });

  it('a continuação de verdade, com Valor e Saldo, segue lida', () => {
    expect(lancamentosDaUnicred([p1, linha('03/01/2026', 'B', '20,00', 620)]).map(l => l.valor)).toEqual([1000, 2000]);
  });
});

describe('Cora', () => {
  it('"Total" no histórico é lançamento; só o resumo sai', () => {
    const dia = [t('30/09/2026', 30, 700), t('Saldo do dia', 300, 700), t('R$ 2.132,69', 500, 700)];
    const p = (y: number, h: string, v: string) => [t(h, 40, y), t(v, 500, y)];
    const pg = [t('Cora SCFI', 30, 40), ...dia, ...p(680, 'Boleto pago TOTAL DE SAIDAS LTDA', '- R$ 10,00'), ...p(660, 'Total Express Logistica', '+ R$ 20,00'), ...p(640, 'Total de entradas', '+ R$ 999,00')];
    expect(lancamentosDaCora([pg]).map(l => l.valor).sort((a, b) => a - b)).toEqual([-1000, 2000]);
  });
});
