import { describe, expect, it } from 'vitest';
import type { ItemDeTexto } from '../extrator/regras/extrato';
import { ehExtratoDaInfinitePay, ehExtratoDaUnicred, ehExtratoDoBancoDoBrasil, lancamentosDaInfinitePay, lancamentosDaUnicred, nomeDoXls } from '.';

const t = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 5 });

// A Unicred nas posições do PDF de verdade (nomes e documentos inventados): Data em 21, Lançamentos em 91, Valor ~390 com o
// "-" solto antes, Saldo ~505.
const UNICRED: ItemDeTexto[] = [
  t('Período de 01/09/2026 a 30/09/2026', 20, 747), t('Coop: 4022 - AG: 5821 - Conta: 111111', 387, 747),
  t('Saldo em 31/08/2026: 1.000,00', 20, 703),
  t('Data', 21, 650), t('Lançamentos', 91, 650), t('Valor', 396, 650), t('(R$)', 424, 650), t('Saldo', 514, 650), t('(R$)', 543, 650),
  t('TRANSFERENCIA TEF PIX ( Doc.: 123 / FULANO', 91, 598), t('02/09/2026', 21, 594), t('-', 382, 594), t('400,00', 392, 594), t('600,00', 509, 594), t('DE TAL )', 91, 587),
  t('RECEBIMENTO DE TED D ( Doc.: 999 /', 91, 409), t('08/09/2026', 21, 405), t('1.500,10', 383, 405), t('2.100,10', 503, 405), t('EMPRESA X LTDA )', 91, 398),
  t('23/09/2026', 21, 108), t('Aplicação CDI Unicred ( Doc.: 555 )', 91, 108), t('-', 371, 108), t('1.000,00', 381, 108), t('1.100,10', 503, 108),
];
const UNICRED_2: ItemDeTexto[] = [
  t('Saldo no final do período', 20, 685), t('1.100,10', 504, 685),
  t('Lançamentos futuros', 20, 490), t('-', 527, 490), t('25,82', 537, 490),
  t('13/10/2026', 20, 470), t('ARRECADACAO DE CONVENIOS (Doc: X)', 90, 470), t('-', 527, 470), t('25,82', 537, 470),
];

describe('extrato da Unicred', () => {
  it('reconhece o layout (e não confunde com o do BB)', () => {
    expect(ehExtratoDaUnicred([UNICRED, UNICRED_2])).toBe(true);
    expect(ehExtratoDoBancoDoBrasil([UNICRED, UNICRED_2])).toBe(false);
  });
  it('junta o histórico de cima, o da linha e o de baixo; o "-" solto é saída; os lançamentos futuros não entram', () => {
    expect(lancamentosDaUnicred([UNICRED, UNICRED_2])).toEqual([
      { data: '2026-09-02', valor: -40000, historico: 'TRANSFERENCIA TEF PIX (Doc.: 123 / FULANO DE TAL)' },
      { data: '2026-09-08', valor: 150010, historico: 'RECEBIMENTO DE TED D (Doc.: 999 / EMPRESA X LTDA)' },
      { data: '2026-09-23', valor: -100000, historico: 'Aplicação CDI Unicred (Doc.: 555)' },
    ]);
  });
});

// A InfinitePay nas posições do PDF de verdade: Data em 13 ("08 Set, 2026"), Hora 97, Tipo 164, Nome 299, Detalhe 568, Valor ~796.
const cab = (y: number) => [t('Data', 13, y), t('Hora', 97, y), t('Tipo de transação', 164, y), t('Nome', 299, y), t('Detalhe', 568, y), t('Valor (R$)', 788, y)];
const INFINITEPAY: ItemDeTexto[] = [
  t('CLOUDWALK -0001 -12345678-9', 689, 535), t('Relatório de movimentações', 16, 540),
  t('Saldo inicial', 421, 500), t('+ 20,92', 790, 500),
  ...cab(398),
  t('08', 13, 374), t('Set,', 26, 374), t('2026', 49, 374), t('02:36', 97, 374), t('Depósito de vendas', 164, 374), t('Vendas', 299, 374), t('Depósito InfinitePay', 568, 374), t('+345,20', 796, 374),
  t('Pix 360 IMPRIMIR GRAFICA', 299, 269), t('15:12', 97, 263), t('Pix', 164, 263), t('Enviado', 568, 263), t('-126,36', 800, 263), t('LTDA', 299, 257),
  t('Saldo do dia', 164, 233), t('+ 239,76', 794, 233),
  ...cab(200),
  t('25', 13, 168), t('Set,', 26, 168), t('2026', 48, 168), t('Pix F HAMATI TECNOLOGIA', 299, 168), t('10:00', 97, 162), t('Pix', 164, 162), t('Enviado', 568, 162), t('-27,89', 805, 162), t('LTDA', 299, 156),
];

describe('relatório da InfinitePay', () => {
  it('reconhece o layout', () => {
    expect(ehExtratoDaInfinitePay([INFINITEPAY])).toBe(true);
    expect(ehExtratoDaUnicred([INFINITEPAY])).toBe(false);
  });
  it('a data vale para o dia; o nome quebrado junta; o tipo não repete; sem o resumo e o Saldo do dia', () => {
    expect(lancamentosDaInfinitePay([INFINITEPAY])).toEqual([
      { data: '2026-09-08', valor: 34520, historico: 'Depósito de vendas Vendas Depósito InfinitePay' },
      { data: '2026-09-08', valor: -12636, historico: 'Pix 360 IMPRIMIR GRAFICA LTDA Enviado' },
      { data: '2026-09-25', valor: -2789, historico: 'Pix F HAMATI TECNOLOGIA LTDA Enviado' },
    ]);
  });
  it('o .xls com o nome como o escritório salva', () => {
    expect(nomeDoXls('InfinitePay', [{ data: '2026-09-08', valor: 1, historico: 'a' }])).toBe('BANCO INFINITEPAY 09.2026.xls');
    expect(nomeDoXls('Unicred', [{ data: '2026-09-08', valor: 1, historico: 'a' }])).toBe('BANCO UNICRED 09.2026.xls');
  });
});
