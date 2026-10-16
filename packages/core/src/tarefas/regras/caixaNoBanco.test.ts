import { describe, expect, it } from 'vitest';
import { caixaNoBanco, notasNoCaixa, passouPeloCaixa, type LancamentoDoExtrato } from './caixaNoBanco';
import type { LancamentoDoRazao } from './razao';

// valores e nomes inventados
const C = (data: string, valor: number, historico: string, nomeContrapartida = 'Fornecedores'): LancamentoDoRazao =>
  ({ data, valor, saldo: 0, contrapartida: '', nomeContrapartida, codigoHistorico: '', historico });
const B = (data: string, valor: number, historico: string): LancamentoDoExtrato => ({ data, valor, historico, banco: 'Sicoob', marca: 'sicoob' });

describe('o caixa × os bancos (16/10/2026)', () => {
  const caixa = [
    C('2026-03-10', 250, 'Pagamento de energia', 'Energia elétrica'), // saiu do caixa: saiu do banco 2 dias antes e 2 depois
    C('2026-03-12', -980.5, 'Recebimento de cliente', 'Clientes'), // entrou no caixa: não é o que se procura
    C('2026-03-15', 1000, 'Depósito no banco', 'Banco Sicoob Credinor'), // a transferência com o banco: fica de fora
    C('2026-03-20', 77, 'Pagamento de frete'), // no banco 9 dias depois: longe demais
    C('2026-04-02', 250, 'Pagamento de energia'), // fora do período
  ];
  const extrato = [
    B('2026-03-12', -25000, 'PAGAMENTO CONTA ENERGIA'),
    B('2026-03-08', -25000, 'PIX ENVIADO'),
    B('2026-03-12', 98050, 'PIX RECEBIDO'),
    B('2026-03-15', -100000, 'TRANSFERENCIA'),
    B('2026-03-29', -7700, 'PIX ENVIADO'),
  ];
  it('o que saiu do caixa e saiu do banco: o mesmo valor, até 5 dias, do mais perto para o mais longe', () => {
    const r = caixaNoBanco(caixa, extrato, ['2026-03']);
    expect(r.map(x => [x.caixa.historico, x.noBanco.map(b => [b.data, b.dias])])).toEqual([
      ['Pagamento de energia', [['2026-03-08', -2], ['2026-03-12', 2]]],
    ]);
  });
  it('a nota em aberto paga pelo caixa: pelo número da NF, ou pelo valor em parcelas iguais (16/10/2026)', () => {
    const cx = [
      // o boleto do fornecedor pago pelo banco e lançado como entrada no caixa (três parcelas da NF 240100)
      C('2026-07-02', -3143.31, 'DÉB. PAGAMENTO DE BOLETO FORNECEDOR EXEMPLO NF 240100 1a3', 'Banco Sicoob'),
      C('2026-07-17', -3143.31, 'DÉB. PAGAMENTO DE BOLETO FORNECEDOR EXEMPLO NF 240100 2a3', 'Banco Sicoob'),
      C('2026-08-03', -3143.31, 'DÉB. PAGAMENTO DE BOLETO FORNECEDOR EXEMPLO NF 240100 3a3', 'Banco Sicoob'),
      // a nota de outro fornecedor paga em dinheiro, em duas vezes, sem a NF no histórico
      C('2026-07-10', 500, 'Pagamento fornecedor', 'Fornecedores'),
      C('2026-07-25', 500, 'Pagamento fornecedor', 'Fornecedores'),
      // o saque: não é pagamento
      C('2026-07-05', -1000, 'SAQUE EM DINHEIRO', 'Banco Sicoob'),
    ];
    const notas = [
      { lado: 'fornecedor' as const, conta: '98000', nome: 'FORNECEDOR EXEMPLO LTDA', nf: '240100', aberto: 9429.93 },
      { lado: 'fornecedor' as const, conta: '98001', nome: 'FORNECEDOR MODELO ME', nf: '555', aberto: 1000 },
      { lado: 'fornecedor' as const, conta: '98002', nome: 'FORNECEDOR SEM NADA', nf: '777', aberto: 1000 },
    ];
    expect(notasNoCaixa(cx, ['2026-07', '2026-08'], notas).map(x => [x.nota.conta, x.como, x.vezes, x.lancamentos.length])).toEqual([
      ['98000', 'nf', 3, 3], ['98001', 'valor', 2, 2],
    ]);
  });
  it('o pagamento do banco que passou pelo caixa: a entrada do banco e a saída para o fornecedor, o mesmo valor (16/10/2026)', () => {
    const cx = [
      C('2026-03-30', -700, 'Pagto. NFe 62000/001 de FORNECEDOR EXEMPLO LTDA', 'Banco Sicoob'),
      C('2026-03-30', 700, 'Pagamento de título nº 62000 -DUP.001 - FORNECEDOR EXEMPLO', 'FORNECEDOR EXEMPLO LTDA'),
      // o depósito de dinheiro no banco (a saída para o banco) e o saque: não são pares
      C('2026-06-23', 700, 'DEP.DINHEIRO', 'Banco Sicoob'),
      C('2026-06-24', -300, 'SAQUE', 'Banco Sicoob'),
      C('2026-06-24', 300, 'Compra à vista', 'Material de consumo'),
    ];
    expect(passouPeloCaixa(cx, ['2026-03', '2026-06']).map(x => [x.entrada.data, x.saida.nomeContrapartida, x.nfs])).toEqual([
      ['2026-03-30', 'FORNECEDOR EXEMPLO LTDA', ['62000']],
    ]);
  });
  it('sem extrato, nada', () => {
    expect(caixaNoBanco(caixa, [], ['2026-03'])).toEqual([]);
  });
});
