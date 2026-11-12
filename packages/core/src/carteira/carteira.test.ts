import { describe, expect, it } from 'vitest';
import type { ContaAPagar } from '../financeiro/contasPagar';
import {
  conferirComissao, conferirLancamento, conferirServicos, mesDoPagamento, novoServico, servicosPadrao, valorDaComissao, historico, liberadaPara, pagamentosDaCarteira, recebidoNoMes, resumoDasFinancas,
  resumoParaPagar, salarioDoMes, totaisDasComissoes, ultimosMeses, type Comissao, type DocumentoDaCarteira, type Lancamento,
} from '.';

const comissao = (id: string, uid: string, valor: number, situacao: Comissao['situacao'], competencia = '2026-11'): Comissao => ({
  id, uid, nome: uid === 'v' ? 'Vitor' : 'Clara', competencia, data: competencia + '-05', cliente: 'Cliente', descricao: 'Venda', valor, situacao, criadoEm: '2026-11-05T10:00:00Z',
});
const lanc = (id: string, tipo: Lancamento['tipo'], valor: number, categoria: string, data = '2026-11-10'): Lancamento => ({ id, tipo, valor, categoria, data, descricao: categoria });
const doc = (tipo: DocumentoDaCarteira['tipo'], competencia: string, valor: number | null, enviadoEm = '2026-11-05T10:00:00Z'): DocumentoDaCarteira => ({
  id: tipo + competencia + enviadoEm, uid: 'v', nome: 'Vitor', tipo, competencia, valor, arquivo: 'h.pdf', tamanho: 1000, partes: 1, enviadoEm, enviadoPor: 'Nilma',
});

describe('Carteira', () => {
  it('liberada só para o Vitor por enquanto (com ou sem acento, com sobrenome)', () => {
    expect(['Vitor', 'Vítor Silva', 'VITOR', ' vitor ', 'Clara', '', null].map(liberadaPara)).toEqual([true, true, true, true, false, false, false]);
  });

  it('confere a comissão e o lançamento antes de salvar', () => {
    const c = { competencia: '2026-12', data: '2026-11-05', cliente: 'A', clienteCodigo: 10, porte: null, servico: 'Emissão de NFE', valorServico: 200, percentual: 10 };
    expect(conferirComissao(c)).toEqual([]);
    // o avulso sem o porte; o serviço sem a % do Financeiro
    expect(conferirComissao({ ...c, clienteCodigo: null })).toEqual(['Escolha o porte do cliente avulso.']);
    expect(conferirComissao({ ...c, clienteCodigo: null, porte: 'ME' })).toEqual([]);
    expect(conferirComissao({ ...c, percentual: 0 })).toEqual(['O Financeiro ainda não definiu a % de Emissão de NFE.']);
    expect(conferirComissao({ competencia: '2026-13', data: '', cliente: ' ', clienteCodigo: 1, porte: null, servico: '', valorServico: 0, percentual: 0 })).toHaveLength(5);
    expect(conferirLancamento({ tipo: 'saida', data: '2026-11-01', descricao: 'Luz', categoria: 'Contas', valor: 120 })).toEqual([]);
    expect(conferirLancamento({ tipo: 'saida', data: '01/11', descricao: '', categoria: '', valor: -1 })).toHaveLength(3);
  });

  it('a comissão sai do valor do serviço × a %; o mês do pagamento é sempre o seguinte', () => {
    expect(valorDaComissao(350, 10)).toBe(35);
    expect(valorDaComissao(199.99, 12.5)).toBe(25);
    expect(mesDoPagamento(new Date(2026, 10, 12))).toBe('2026-12');
    expect(mesDoPagamento(new Date(2026, 11, 31))).toBe('2027-01');
  });

  it('os serviços comissionados: os 9 do começo, um novo sem repetir o id e a conferência', () => {
    const l = servicosPadrao();
    expect(l).toHaveLength(9);
    expect(l[0]).toEqual({ id: 'emissao-de-nfe', nome: 'Emissão de NFE', percentual: 0 });
    expect(novoServico(l, 'Emissão de NFE ').id).toBe('emissao-de-nfe-2');
    expect(conferirServicos(l)).toEqual([]);
    expect(conferirServicos([...l, { id: 'x', nome: 'emissao de nfe', percentual: 120 }])).toEqual(['A % fica entre 0 e 100.', 'Há serviço repetido.']);
  });

  it('totais das comissões e o resumo para o Financeiro pagar, por pessoa', () => {
    const cs = [comissao('1', 'v', 100, 'lancada'), comissao('2', 'v', 250.5, 'aprovada'), comissao('3', 'v', 50, 'paga'), comissao('4', 'v', 999, 'recusada'), comissao('5', 'c', 300, 'aprovada')];
    expect(totaisDasComissoes(cs.filter(c => c.uid === 'v'))).toEqual({ lancadas: 100, aprovadas: 250.5, pagas: 50, recusadas: 999, total: 400.5, quantas: 3 });
    const r = resumoParaPagar(cs);
    expect(r.map(x => [x.nome, x.aRevisar, x.aPagar, x.pagas, x.ids.aprovadas])).toEqual([['Clara', 0, 300, 0, ['5']], ['Vitor', 100, 250.5, 50, ['2']]]);
  });

  it('finanças do mês: entradas, saídas, saldo e as saídas por categoria', () => {
    const ls = [lanc('1', 'entrada', 3000, 'Salário'), lanc('2', 'saida', 900, 'Moradia'), lanc('3', 'saida', 300, 'Alimentação'), lanc('4', 'saida', 600, 'Moradia'), lanc('5', 'saida', 50, 'Lazer', '2026-10-30')];
    const r = resumoDasFinancas(ls, '2026-11');
    expect([r.entradas, r.saidas, r.saldo]).toEqual([3000, 1800, 1200]);
    expect(r.porCategoria.map(x => [x.categoria, x.valor])).toEqual([['Moradia', 1500], ['Alimentação', 300]]);
  });

  it('o salário do mês vem do holerite mais novo daquele mês', () => {
    const ds = [doc('holerite', '2026-10', 2800), doc('holerite', '2026-11', 3000), doc('holerite', '2026-11', 3100, '2026-11-06T10:00:00Z'), doc('comprovante', '2026-11', 3100)];
    expect([salarioDoMes(ds, '2026-11'), salarioDoMes(ds, '2026-10'), salarioDoMes(ds, '2026-09')]).toEqual([3100, 2800, null]);
    expect(historico(ultimosMeses(new Date(2026, 10, 12), 2), [comissao('1', 'v', 100, 'aprovada')], [lanc('1', 'entrada', 10, 'Extra')], ds))
      .toEqual([{ competencia: '2026-10', salario: 2800, comissoes: 0, saldo: 0 }, { competencia: '2026-11', salario: 3100, comissoes: 100, saldo: 10 }]);
  });

  it('as contas a pagar ligadas à pessoa viram os pagamentos da Carteira (só os comprovantes aparecem)', () => {
    const conta = (id: string, uid: string | null, vencimento: string, pago: boolean): ContaAPagar => ({
      id, numero: 1, fornecedorId: 'f', documento: 'NOV', emissao: vencimento, vencimento, valor: 3000, lancadoEm: '', lancadoPor: '',
      ...(uid ? { funcionario: { uid, nome: 'Vitor', tipo: 'salario' as const } } : {}),
      ...(pago ? { pagamento: { data: vencimento, valorPago: 2990, juros: 0, desconto: 10, por: 'Nilma', em: '' } } : {}),
      anexos: [{ id: 'b', tipo: 'boleto', nome: 'b.pdf', tamanho: 1, partes: 1, enviadoEm: '', enviadoPor: '' }, ...(pago ? [{ id: 'c', tipo: 'comprovante' as const, nome: 'pix.pdf', tamanho: 2, partes: 1, enviadoEm: '', enviadoPor: '' }] : [])],
    });
    const ps = pagamentosDaCarteira([conta('1', 'v', '2026-10-05', true), conta('2', 'v', '2026-11-05', false), conta('3', 'outro', '2026-11-05', true), conta('4', null, '2026-11-05', true)], 'v');
    expect(ps.map(p => [p.id, p.rotulo, p.pago, p.comprovantes.map(c => c.nome)])).toEqual([['2', 'Salário · NOV', false, []], ['1', 'Salário · NOV', true, ['pix.pdf']]]);
    expect([recebidoNoMes(ps, '2026-10'), recebidoNoMes(ps, '2026-11')]).toEqual([{ recebido: 2990, aReceber: 0 }, { recebido: 0, aReceber: 3000 }]);
  });
});
