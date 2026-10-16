import { describe, expect, it } from 'vitest';
import { caixaNoBanco, type LancamentoDoExtrato } from './caixaNoBanco';
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
  it('sem extrato, nada', () => {
    expect(caixaNoBanco(caixa, [], ['2026-03'])).toEqual([]);
  });
});
