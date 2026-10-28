import { describe, expect, it } from 'vitest';
import {
  avisoDeVencimento, conferirContaAPagar, conferirFornecedor, conferirPagamento, contaPadraoDoFornecedor, descricaoDoPagamento, filtrarContas,
  linhasDasContas, nomeDoFornecedor, periodoDasContas, proximoNumero, situacaoDaConta, totaisDasContas, valorComJuros, vencimentosDaRecorrencia,
  type ContaAPagar, type ContaDoPlano,
} from './index';

const HOJE = '2026-10-28';
const c = (numero: number, vencimento: string, valor: number, extra: Partial<ContaAPagar> = {}): ContaAPagar =>
  ({ id: 'c' + numero, numero, fornecedorId: 'f1', documento: String(100 + numero), emissao: '2026-10-01', vencimento, valor, anexos: [], lancadoEm: '', lancadoPor: '', ...extra });
const pago = (valorPago: number) => ({ data: HOJE, valorPago, juros: 0, desconto: 0, por: 'x', em: '' });
const conta = (id: string, codigo: string): ContaDoPlano => ({ id, codigo, descricao: 'Aluguel', tipo: 'DESPESA', nivel: 3, pai: null, ativo: true, movimentavel: true });

describe('as contas a pagar', () => {
  it('a situação pelas datas', () => {
    expect(situacaoDaConta(c(1, '2026-10-27', 10), HOJE)).toBe('vencida');
    expect(situacaoDaConta(c(1, HOJE, 10), HOJE)).toBe('aberta');
    expect(situacaoDaConta(c(1, '2026-10-01', 10, { pagamento: pago(10) }), HOJE)).toBe('paga');
  });
  it('a recorrência: um por mês, no mesmo dia, no último dia do mês que não tem o dia', () => {
    expect(vencimentosDaRecorrencia('2026-01-31', 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(vencimentosDaRecorrencia('2027-12-31', 3)).toEqual(['2027-12-31', '2028-01-31', '2028-02-29']);
    expect(vencimentosDaRecorrencia('2026-10-10', 12)).toHaveLength(12);
    expect(vencimentosDaRecorrencia('2026-02-30', 2)).toEqual([]);
  });
  it('confere a conta, o pagamento e o fornecedor', () => {
    expect(conferirContaAPagar({ fornecedorId: 'f1', emissao: '', vencimento: HOJE, valor: 10 })).toEqual([]);
    expect(conferirContaAPagar({ fornecedorId: '', emissao: '2026-13-01', vencimento: '', valor: 0 }, 1)).toHaveLength(5);
    expect(conferirPagamento({ data: HOJE, valorPago: 10, juros: 0, desconto: 0 })).toEqual([]);
    expect(conferirPagamento({ data: '', valorPago: 0, juros: -1, desconto: 0 })).toHaveLength(3);
    expect(conferirFornecedor({ razaoSocial: 'ALFA LTDA', nomeFantasia: '', documento: '11.222.333/0001-81' })).toEqual([]);
    expect(conferirFornecedor({ razaoSocial: '', nomeFantasia: '', documento: '123' })).toHaveLength(2);
  });
  it('o valor com juros e desconto, sem erro de vírgula', () => {
    expect(valorComJuros(100.1, 0.2, 0.05)).toBe(100.25);
  });
  it('o nome, a conta padrão (pelo id ou pela classificação) e a descrição no Caixa', () => {
    expect(nomeDoFornecedor({ razaoSocial: 'CEMIG DISTRIBUICAO SA', nomeFantasia: ' ' })).toBe('CEMIG DISTRIBUICAO SA');
    const plano = [conta('p1', '5.1.01'), conta('p2', '5.1.02')];
    expect(contaPadraoDoFornecedor({ contaPadrao: 'p2' }, plano)).toBe('p2');
    expect(contaPadraoDoFornecedor({ contaPadrao: '5.1.01' }, plano)).toBe('p1');
    expect(contaPadraoDoFornecedor({ contaPadrao: '9.9' }, plano)).toBe('');
    expect(descricaoDoPagamento('Cemig', '123', { grupo: 'g', parcela: 2, de: 12 })).toBe('PAG CEMIG DOC 123 2/12');
    expect(descricaoDoPagamento('Cemig', '')).toBe('PAG CEMIG');
    expect(proximoNumero([{ numero: 3 }, { numero: 7 }])).toBe(8);
    expect(proximoNumero([])).toBe(1);
  });
  it('os períodos pelo vencimento: o mês inteiro', () => {
    expect(periodoDasContas('este-mes', HOJE)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(periodoDasContas('proximo-mes', '2026-12-05')).toEqual({ de: '2027-01-01', ate: '2027-01-31' });
    expect(periodoDasContas('mes-passado', '2026-03-05')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(periodoDasContas('tudo', HOJE)).toEqual({ de: '', ate: '' });
  });
  it('filtra e soma', () => {
    const lista = [c(1, '2026-10-05', 100), c(2, '2026-10-20', 50.1, { pagamento: pago(51.3) }), c(3, '2026-11-02', 30, { fornecedorId: 'f2', conta: 'p1' }), c(4, '2026-10-30', 20)];
    const f = { de: '2026-10-01', ate: '2026-10-31', fornecedor: '', conta: '', situacao: 'todas' as const, busca: '' };
    const nome = (id: string) => (id === 'f2' ? 'Copasa' : 'Cemig');
    expect(filtrarContas(lista, f, HOJE, nome).map(x => x.numero)).toEqual([1, 2, 4]);
    expect(filtrarContas(lista, { ...f, situacao: 'vencida' }, HOJE, nome).map(x => x.numero)).toEqual([1]);
    expect(filtrarContas(lista, { ...f, de: '', ate: '', busca: 'copasa' }, HOJE, nome).map(x => x.numero)).toEqual([3]);
    expect(filtrarContas(lista, { ...f, de: '', ate: '', conta: 'p1' }, HOJE, nome).map(x => x.numero)).toEqual([3]);
    expect(totaisDasContas(lista, HOJE)).toEqual({ quantas: 4, valor: 200.1, pago: 51.3, aPagar: 150, vencido: 100 });
  });
  it('o aviso do Painel: as vencidas, as de hoje e as dos próximos 7 dias', () => {
    const lista = [c(1, '2026-10-01', 10), c(2, HOJE, 20), c(3, '2026-11-04', 30), c(4, '2026-11-05', 40), c(5, '2026-10-02', 99, { pagamento: pago(99) })];
    const a = avisoDeVencimento(lista, HOJE);
    expect([a.vencidas.map(x => x.numero), a.hoje.map(x => x.numero), a.proximas.map(x => x.numero)]).toEqual([[1], [2], [3]]);
    expect([a.totalVencido, a.totalDaSemana]).toEqual([10, 50]);
  });
  it('a planilha: o cabeçalho, uma linha por conta e os totais', () => {
    const linhas = linhasDasContas([{ conta: c(1, '2026-10-05', 100, { recorrencia: { grupo: 'g', parcela: 1, de: 3 } }), fornecedor: 'Cemig', contaDoPlano: conta('p1', '5.1.01') }], HOJE, 'Vencimento: tudo');
    expect(linhas[3][0]).toBe('ID');
    expect(linhas[4]).toEqual(['1', 'Cemig', '101', '5.1.01 Aluguel', '01/10/2026', '05/10/2026', 100, 'Vencida', '', '', '', '', '1/3', '']);
    expect(linhas.at(-1)).toEqual(['', 'Vencido', '', '', '', '', 100]);
  });
});
