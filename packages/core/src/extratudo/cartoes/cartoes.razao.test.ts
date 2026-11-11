// O razão do cartão × as faturas (Vitor, 11/11/2026) e o layout novo da fatura do Sicoob. Dados fictícios.
import { describe, expect, it } from 'vitest';
import { lerFatura, type ItemDaFatura, type PedacoDaFatura } from './regras/fatura';
import { conferirComORazao, historicoDoTitulo, lancamentosQueFaltam, saldosDoCartao, type LancamentoDoCartao } from './regras/razao';

const compra = (data: string, descricao: string, valor: number): ItemDaFatura => ({ data, descricao, valor, portador: 'FULANO (1234)' });
const lanc = (data: string, valor: number, historico: string, saldo = 0, contrapartida = '10501'): LancamentoDoCartao =>
  ({ data, valor, historico, saldo, contrapartida, nomeContrapartida: '', codigoHistorico: valor < 0 && /^Pagamento/.test(historico) ? '00189' : '' });

describe('as compras da fatura × o razão do cartão', () => {
  const razao = {
    saldoInicial: 1000,
    lancamentos: [
      // pagamento de janeiro já lançado: o título e o posto sem nota
      lanc('2026-01-05', -300, 'Pagamento de título nº 10-0001-FORNECEDOR ALFA', 700),
      lanc('2026-01-05', -200, 'POSTO SEM NOTA CIDADE', 500),
      lanc('2026-01-05', 300, 'Antecipação de Cartão 10-0001-FORNECEDOR ALFA', 800, '20001'),
      // a compra parcelada em 3, inteira, na data da nota
      lanc('2026-01-09', 600, 'Antecipação de Cartão 77-0002-LOJA BETA', 1400, '20002'),
    ],
  };
  const faturas = [
    { id: 'jan', dia: '2026-01-05', compras: [compra('2025-12-20', 'LOJA ALFA', 300), compra('2025-12-22', 'POSTO SEM NOTA CIDADE', 200), compra('2025-09-01', 'GAMA 04/05 CIDADE', 50)] },
    { id: 'fev', dia: '2026-02-03', compras: [compra('2026-01-09', 'BETA 01/03 CIDADE', 200), compra('2026-01-20', 'POSTO DOIS CIDADE', 150)] },
  ];
  const cs = conferirComORazao(faturas, razao);

  it('com nota, sem nota e a parcela de compra de antes do razão; o pagamento já lançado não sai de novo', () => {
    expect(cs.map(c => [c.item.descricao, c.situacao, !!c.pago])).toEqual([
      ['GAMA 04/05 CIDADE', 'parcela-anterior', false],
      ['LOJA ALFA', 'com-nota', true],
      ['POSTO SEM NOTA CIDADE', 'sem-nota', true],
      ['BETA 01/03 CIDADE', 'com-nota', false],
      ['POSTO DOIS CIDADE', 'sem-nota', false],
    ]);
  });

  it('o histórico do pagamento é o do título, com a parcela depois do número', () => {
    expect(cs.find(c => c.item.descricao.startsWith('BETA'))?.historicoDoPagamento).toBe('Pagamento de título nº 77/1-0002-LOJA BETA');
    expect(historicoDoTitulo('Pagamento de título nº 1345/001 - POSTO', null)).toBe('Pagamento de título nº 1345/001 - POSTO');
  });

  it('o que falta: o pagamento (D cartão / C banco) e, do sem nota, D caixa / C cartão na data da compra (antes do período, no pagamento)', () => {
    const dia = (f: string) => faturas.find(x => x.id === f)!.dia;
    const falta = lancamentosQueFaltam(cs, dia, { cartao: 'CART', caixa: 'CX', banco: () => 'BCO', historicoDoTitulo: '00189' }, '2026-01-01');
    expect(falta.map(x => [x.linha.data, x.linha.debito, x.linha.credito, x.linha.valor, x.linha.codHistorico])).toEqual([
      ['05/01/2026', 'CART', 'BCO', 50, ''],
      ['05/01/2026', 'CX', 'CART', 200, ''],
      ['20/01/2026', 'CX', 'CART', 150, ''],
      ['03/02/2026', 'CART', 'BCO', 200, '00189'],
      ['03/02/2026', 'CART', 'BCO', 150, ''],
    ]);
    // o saldo: o da coluna Saldo do razão e com o que falta (positivo = credor)
    expect(saldosDoCartao(razao, ['2026-01', '2026-02'], falta)).toEqual([
      { mes: '2026-01', razao: 1400, comLancamentos: 1700 },
      { mes: '2026-02', razao: 1400, comLancamentos: 1350 },
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
