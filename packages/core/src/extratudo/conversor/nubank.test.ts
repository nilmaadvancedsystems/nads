import { describe, expect, it } from 'vitest';
import type { ItemDeTexto } from '../extrator/regras/extrato';
import { ehExtratoDaCora, ehExtratoDoNubank, lancamentosDoNubank, NOMES_DE_BANCO } from '.';

const t = (texto: string, x: number, y: number): ItemDeTexto => ({ texto, x, y, largura: texto.length * 5 });

// O Nubank PJ nas posições do PDF de verdade (nomes e contas inventados): a data em 58, o tipo em 120, a contraparte em 259 e
// o valor em ~505; o cabeçalho de cada página até o "VALORES EM R$" e o rodapé com o atendimento.
const topo = (y: number) => [
  t('EMPRESA TESTE LTDA', 389, y + 76), t('CNPJ', 327, y + 63), t('00.000.000/0001-00', 356, y + 63), t('Agência', 442, y + 63), t('0001', 484, y + 63),
  t('01 DE SETEMBRO DE 2026', 57, y), t('a', 175, y), t('30 DE SETEMBRO DE 2026', 182, y), t('VALORES EM R$', 469, y),
];
const rodape = (y: number) => [t('Tem alguma dúvida? Mande uma mensagem para nosso time', 57, y), t('disponíveis em nubank.com.br/contatos#ouvidoria .', 57, y - 36), t('1 de 2', 512, y - 56)];
const PAG_1: ItemDeTexto[] = [
  ...topo(699),
  t('Saldo inicial', 321, 670), t('100,00', 505, 670), t('Saldo final do período', 57, 645), t('Total de entradas', 321, 630), t('+150,00', 489, 630),
  t('Movimentações', 57, 561),
  t('01 SET 2026', 58, 539), t('Total de entradas', 120, 539), t('+ 150,00', 494, 539),
  t('Transferência recebida pelo Pix', 120, 518), t('FULANO DE TAL - •••.', 259, 518), t('100,00', 505, 518),
  t('123.456-•• - BCO BRADESCO S.A. (0237) Agência: 2557 Conta: 60355-', 259, 498), t('4', 259, 478),
  t('Transferência Recebida', 120, 457), t('Beltrano Silva - •••.111.222-•• - NU', 259, 457), t('50,00', 510, 457),
  t('PAGAMENTOS - IP (0260) Agência: 1 Conta:', 259, 437),
  ...rodape(114),
];
const PAG_2: ItemDeTexto[] = [
  ...topo(705),
  t('12345678-9', 259, 674),
  t('Total de saídas', 120, 653), t('- 1.250,00', 496, 653),
  t('Pagamento de boleto efetuado', 120, 632), t('FORNECEDOR X', 259, 632), t('1.000,00', 500, 632),
  t('Transferência enviada pelo Pix', 120, 611), t('LOJA Y - 03.238.183/0001-76 - CC', 259, 611), t('250,00', 507, 611),
  t('Saldo do dia', 120, 580), t('0,00', 512, 580),
  t('02 SET 2026', 58, 548), t('Total de saídas', 120, 548), t('- 10,00', 496, 548),
  t('Pagamento de fatura', 120, 527), t('10,00', 510, 527),
  t('Saldo do dia', 120, 496), t('-10,00', 505, 496),
  t('O saldo líquido corresponde ao total de depósitos e rendimentos em conta.', 57, 200), t('Nu Pagamentos S.A. - Instituição de Pagamento', 321, 156),
  ...rodape(109),
];

describe('extrato do Nubank', () => {
  it('reconhece o layout (e o Pix de uma conta da Cora no meio não engana)', () => {
    expect(ehExtratoDoNubank([PAG_1, PAG_2])).toBe(true);
    expect(ehExtratoDoNubank([[t('30/09/2026', 20, 500), t('Saldo do dia', 200, 500), t('Cora SCFI', 20, 50)]])).toBe(false);
    expect(ehExtratoDaCora([PAG_1, PAG_2])).toBe(false);
  });
  it('o sinal vem do total de cima; a contraparte junta as linhas de baixo, também as da página seguinte', () => {
    expect(lancamentosDoNubank([PAG_1, PAG_2])).toEqual([
      { data: '2026-09-01', valor: 10000, historico: 'Transferência recebida pelo Pix FULANO DE TAL - •••.123.456-•• - BCO BRADESCO S.A. (0237) Agência: 2557 Conta: 60355-4' },
      { data: '2026-09-01', valor: 5000, historico: 'Transferência Recebida Beltrano Silva - •••.111.222-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 12345678-9' },
      { data: '2026-09-01', valor: -100000, historico: 'Pagamento de boleto efetuado FORNECEDOR X' },
      { data: '2026-09-01', valor: -25000, historico: 'Transferência enviada pelo Pix LOJA Y - 03.238.183/0001-76 - CC' },
      { data: '2026-09-02', valor: -1000, historico: 'Pagamento de fatura' },
    ]);
  });
  it('o menu de bancos só tem os com layout registrado', () => {
    expect(NOMES_DE_BANCO).toEqual(['Banco do Brasil', 'Cora', 'InfinitePay', 'Nubank', 'Unicred']);
  });
});
