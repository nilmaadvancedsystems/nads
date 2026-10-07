import { describe, expect, it } from 'vitest';
import { comprasDaFatura, lancamentosDaFatura, lerFatura, nomeDoArquivoDoCartao, pagamentoNoExtrato, type PedacoDaFatura } from '.';

// a fatura do Sicoob no mesmo desenho do PDF de verdade (nomes e números trocados): a data em x≈98, a descrição no meio,
// o valor em x≈450; uma descrição longa quebrada em volta da linha da data
let y = 800;
const L = (...partes: [number, string][]): PedacoDaFatura[] => { y -= 12; return partes.map(([x, texto]) => ({ x, y, texto })); };
const PAGINA: PedacoDaFatura[] = [
  ...L([206, 'EXTRATO DE CARTÃO DE CRÉDITO']),
  ...L([98, 'Cliente:'], [143, 'EMPRESA TESTE LTDA']),
  ...L([98, 'Conta Cartão:'], [176, '7560000000001']),
  ...L([98, 'Fatura de FEVEREIRO'], [375, 'Vencimento: 03/02/2026']),
  ...L([260, 'MOVIMENTOS']),
  ...L([98, '-'], [254, 'SALDO ANTERIOR'], [453, '5.768,88']),
  ...L([98, '05/01'], [220, 'PAGAMENTO DEBITO EM CONTA'], [449, '-5.768,88']),
  ...L([98, '08/01'], [225, 'PROTEÇÃO PERDA OU ROUBO'], [475, '3,20']),
  ...L([98, '08/01'], [223, 'CRÉDITO PROMOÇÃO SEGURO'], [471, '-3,20']),
  ...L([98, '21/02'], [202, 'ANUIDADE MASTERCARD (1111) 11/12'], [469, '15,50']),
  ...L([98, '21/02'], [220, 'DESC ANUIDADE POR USO MAS'], [465, '-15,50']),
  ...L([201, 'GASTOS DE FULANO SILVA (1111)']),
  ...L([258, 'LIMITE 10.000']),
  ...L([98, '18/01'], [233, 'POSTO DO CENTRO SALINAS'], [453, '1.301,69']),
  ...L([98, '23/01'], [218, 'POSTO DA SERRA TAIOBEIRAS'], [469, '62,92']),
  ...L([199, 'EMBALAGENS NORTE 01/02 MONTES']),
  ...L([98, '23/01'], [453, '1.960,00']),
  ...L([278, 'CLAROS']),
  ...L([282, 'TOTAL'], [453, '3.324,61']),
  ...L([213, 'GASTOS DE BELTRANA SILVA']),
  ...L([279, '(2222)']),
  ...L([98, '27/08'], [208, 'MATERIAIS SA 05/06 TAIOBEIRAS'], [463, '400,28']),
  ...L([187, 'DEMONSTRATIVO DE PAGAMENTO EM R$']),
  ...L([98, 'Total da Fatura'], [453, '3.724,89']),
  ...L([98, 'Pagamento Mínimo'], [453, '1.007,02']),
];

describe('a fatura do cartão empresarial', () => {
  const f = lerFatura([PAGINA]);

  it('lê o cabeçalho, os gastos por portador e remonta a descrição quebrada', () => {
    expect([f.contaCartao, f.cliente, f.vencimento, f.total]).toEqual(['7560000000001', 'EMPRESA TESTE LTDA', '2026-02-03', 3724.89]);
    expect(f.itens.map(i => [i.data, i.descricao, i.valor, i.portador])).toEqual([
      ['2026-01-05', 'PAGAMENTO DEBITO EM CONTA', -5768.88, ''],
      ['2026-01-08', 'PROTEÇÃO PERDA OU ROUBO', 3.2, ''],
      ['2026-01-08', 'CRÉDITO PROMOÇÃO SEGURO', -3.2, ''],
      // dia depois do vencimento no mesmo mês: do ano anterior
      ['2025-02-21', 'ANUIDADE MASTERCARD (1111) 11/12', 15.5, ''],
      ['2025-02-21', 'DESC ANUIDADE POR USO MAS', -15.5, ''],
      ['2026-01-18', 'POSTO DO CENTRO SALINAS', 1301.69, 'FULANO SILVA (1111)'],
      ['2026-01-23', 'POSTO DA SERRA TAIOBEIRAS', 62.92, 'FULANO SILVA (1111)'],
      ['2026-01-23', 'EMBALAGENS NORTE 01/02 MONTES CLAROS', 1960, 'FULANO SILVA (1111)'],
      ['2025-08-27', 'MATERIAIS SA 05/06 TAIOBEIRAS', 400.28, 'BELTRANA SILVA (2222)'],
    ]);
  });

  it('as compras: sem o pagamento anterior e sem os pares que se anulam; a soma bate com o total', () => {
    const c = comprasDaFatura(f);
    expect(c.compras.map(i => i.descricao)).toEqual(['POSTO DO CENTRO SALINAS', 'POSTO DA SERRA TAIOBEIRAS', 'EMBALAGENS NORTE 01/02 MONTES CLAROS', 'MATERIAIS SA 05/06 TAIOBEIRAS']);
    expect(c.deFora.map(d => d.motivo)).toEqual([
      'Pagamento da fatura anterior',
      'Anulado por "CRÉDITO PROMOÇÃO SEGURO"', 'Anula "PROTEÇÃO PERDA OU ROUBO"',
      'Anulado por "DESC ANUIDADE POR USO MAS"', 'Anula "ANUIDADE MASTERCARD (1111) 11/12"',
    ]);
    expect([c.soma, c.diferenca]).toEqual([3724.89, 0]);
  });

  it('o dia do pagamento vem do extrato (o débito com o valor da fatura, perto do vencimento)', () => {
    const extrato = [
      { data: '2026-02-02', valor: -372489, historico: 'PIX EMIT.OUTRA IF', banco: 'sicoob' },
      { data: '2026-02-04', valor: -372489, historico: 'DÉB.CONV.CARTÃO SICOOBCARD', banco: 'sicoob' },
      { data: '2026-02-03', valor: -100, historico: 'TARIFA', banco: 'sicoob' },
    ];
    expect(pagamentoNoExtrato(f, 3724.89, extrato)).toEqual({ data: '2026-02-04', banco: 'sicoob', historico: 'DÉB.CONV.CARTÃO SICOOBCARD', diasDoVencimento: 1 });
    expect(pagamentoNoExtrato(f, 3724.89, [{ data: '2026-03-20', valor: -372489, historico: 'X', banco: 'sicoob' }])).toBeNull();
  });

  it('o razão: D cartão / C banco, no dia do pagamento, com a descrição no histórico', () => {
    const ls = lancamentosDaFatura(comprasDaFatura(f), '2026-02-04', '21105', '10503');
    expect(ls[0]).toEqual({ automatico: '', data: '04/02/2026', debito: '21105', credito: '10503', codHistorico: '', historico: 'POSTO DO CENTRO SALINAS', valor: 1301.69, documento: '' });
    expect(ls).toHaveLength(4);
    expect(nomeDoArquivoDoCartao('292', '2026-02-03')).toBe('cartao_importacao_292_2026-02.xls');
  });
});
