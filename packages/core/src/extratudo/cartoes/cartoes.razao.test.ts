// O razão do cartão gerado das faturas e das notas de entrada (Vitor, 11/11/2026) e o layout novo da fatura do Sicoob.
// Dados fictícios.
import { describe, expect, it } from 'vitest';
import { lerFatura, type ItemDaFatura, type PedacoDaFatura } from './regras/fatura';
import { conferirComAsNotas, movimentoDoCartao, razaoDoCartao, type NotaDeEntrada } from './regras/razao';

const compra = (data: string, descricao: string, valor: number): ItemDaFatura => ({ data, descricao, valor, portador: 'FULANO (1234)' });
const nota = (numero: string, nome: string, data: string, valor: number, conta = '20001'): NotaDeEntrada => ({ numero, doc: '11222333000144', nome, data, valor, conta });

describe('o razão do cartão gerado das faturas', () => {
  const notas = [nota('000010', 'FORNECEDOR ALFA', '2026-01-04', 300), nota('77', 'LOJA BETA', '2026-01-09', 600, '')];
  const faturas = [
    { id: 'jan', dia: '2026-01-05', compras: [compra('2025-12-28', 'LOJA ALFA', 300), compra('2025-12-22', 'POSTO SEM NOTA', 200), compra('2025-09-01', 'GAMA 04/05 CIDADE', 50)] },
    { id: 'fev', dia: '2026-02-03', compras: [compra('2026-01-09', 'BETA 01/03 CIDADE', 200), compra('2026-01-20', 'POSTO DOIS', 150)] },
    { id: 'mar', dia: '2026-03-03', compras: [compra('2026-01-09', 'BETA 02/03 CIDADE', 200)] },
  ];
  const cs = conferirComAsNotas(faturas, notas, '2026-01-01');

  it('com nota (a parcelada pelo valor inteiro), sem nota e a parcela de compra de antes do período', () => {
    expect(cs.map(c => [c.item.descricao, c.situacao, c.creditaANota])).toEqual([
      ['GAMA 04/05 CIDADE', 'parcela-anterior', false],
      ['POSTO SEM NOTA', 'sem-nota', false],
      ['LOJA ALFA', 'com-nota', true],
      ['BETA 01/03 CIDADE', 'com-nota', true],
      ['POSTO DOIS', 'sem-nota', false],
      ['BETA 02/03 CIDADE', 'com-nota', false],
    ]);
  });

  it('os dois lados: a nota ou o caixa no crédito, o pagamento no débito com o texto do título e a parcela', () => {
    const dia = (f: string) => faturas.find(x => x.id === f)!.dia;
    const r = razaoDoCartao(cs, dia, { cartao: 'CART', caixa: 'CX', banco: () => 'BCO', fornecedorSemConta: 'ADTO' }, '2026-01-01');
    expect(r.map(x => [x.linha.data, x.linha.debito, x.linha.credito, x.linha.valor, x.linha.historico])).toEqual([
      ['04/01/2026', '20001', 'CART', 300, 'Antecipação de Cartão 10-11222333000144-FORNECEDOR ALFA'],
      ['05/01/2026', 'CART', 'BCO', 50, 'GAMA 04/05 CIDADE'],
      ['05/01/2026', 'CX', 'CART', 200, 'POSTO SEM NOTA'],
      ['05/01/2026', 'CART', 'BCO', 200, 'POSTO SEM NOTA'],
      ['05/01/2026', 'CART', 'BCO', 300, 'Pagamento de título nº 10-11222333000144-FORNECEDOR ALFA'],
      ['09/01/2026', 'ADTO', 'CART', 600, 'Antecipação de Cartão 77-11222333000144-LOJA BETA'],
      ['20/01/2026', 'CX', 'CART', 150, 'POSTO DOIS'],
      ['03/02/2026', 'CART', 'BCO', 200, 'Pagamento de título nº 77/1-11222333000144-LOJA BETA'],
      ['03/02/2026', 'CART', 'BCO', 150, 'POSTO DOIS'],
      ['03/03/2026', 'CART', 'BCO', 200, 'Pagamento de título nº 77/2-11222333000144-LOJA BETA'],
    ]);
    expect(movimentoDoCartao(r, ['2026-01', '2026-02', '2026-03'])).toEqual([
      { mes: '2026-01', creditos: 1250, debitos: 550, acumulado: 700 },
      { mes: '2026-02', creditos: 0, debitos: 350, acumulado: 350 },
      { mes: '2026-03', creditos: 0, debitos: 200, acumulado: 150 },
    ]);
  });
});

describe('o layout novo da fatura do Sicoob (setembro de 2026)', () => {
  const p = (texto: string, x: number, y: number): PedacoDaFatura => ({ texto, x, y });
  const paginas: PedacoDaFatura[][] = [
    [p('Esta é a fatura de setembro', 144, 486), p('no valor total de', 144, 456), p('R$ 1.050,00', 340, 456), p('VENCIMENTO', 248, 385), p('3 SET 2026', 351, 385)],
    [p('EMPRESA EXEMPLO LTDA', 60, 802)],
    [
      p('LANÇAMENTOS - SICOOB MASTERCARD EMPRESARIAL PRO', 21, 757),
      p('PAGAMENTO DEBITO EM', 68, 696), p('03 AGO', 28, 692), p('-R$ 900,00', 237, 692), p('CONTA', 68, 688),
      p('FULANO DE TAL', 26, 515), p('0051', 246, 515),
      p('27 JUL', 28, 494), p('POSTO UM', 68, 494), p('CIDADE', 176, 494), p('R$ 800,00', 240, 494),
      p('19 AGO', 305, 719), p('LOJA 02/10', 345, 719), p('OUTRA', 459, 719), p('R$ 250,00', 517, 719),
      p('Veja como você usou seu cartão', 20, 322), p('POSTOS DE GASOLINA', 228, 177), p('R$ 800,00', 319, 177),
    ],
  ];
  it('lê o vencimento, o total e os lançamentos das duas colunas, com o portador', () => {
    const f = lerFatura(paginas);
    expect([f.vencimento, f.total, f.cliente]).toEqual(['2026-09-03', 1050, 'EMPRESA EXEMPLO LTDA']);
    expect(f.itens.map(i => [i.data, i.descricao, i.valor, i.portador])).toEqual([
      ['2026-08-03', 'PAGAMENTO DEBITO EM CONTA', -900, ''],
      ['2026-07-27', 'POSTO UM CIDADE', 800, 'FULANO DE TAL (0051)'],
      ['2026-08-19', 'LOJA 02/10 OUTRA', 250, 'FULANO DE TAL (0051)'],
    ]);
  });
});
