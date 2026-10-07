import { describe, expect, it } from 'vitest';
import { bancoDoRazao, bancoPelosContratos, contratosDoRazao, emprestimosNoPeriodo, emprestimosParaOCadastro, mesesDevedores, numeroDoContrato } from './emprestimos';
import { lerRazao, mesesDoRazao } from './razao';

const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const L = (data: string, contra: string, valor: number, saldo: number) => ['', '', data, '', contra, 'x', valor, '', 'x', saldo, ''];
// um empréstimo no Sicoob (10503): o crédito do contrato e as parcelas pagas; os juros contra a despesa (85001)
const RAZAO = lerRazao([CAB,
  L('10/01/2026', '10503', 30000, 30000),
  L('10/02/2026', '10503', -2500, 27500),
  L('10/02/2026', '85001', 300, 27800),
  L('10/03/2026', '10503', -2800, 25000),
]);
const BANCOS = [{ id: 'itau', nome: 'Itaú', contaContabil: '10510' }, { id: 'sicoob', nome: 'Sicoob', contaContabil: '10503' }, { id: 'bb', nome: 'BB' }];

describe('empréstimos e financiamentos', () => {
  it('o banco vem da contrapartida que mais aparece (a conta contábil do banco no Cadastro)', () => {
    expect(bancoDoRazao(RAZAO, BANCOS)).toBe('sicoob');
    expect(bancoDoRazao(RAZAO, [{ id: 'bb', nome: 'BB' }])).toBeNull();
  });
  it('fica credor ou zera: o mês devedor aparece', () => {
    expect(mesesDevedores(mesesDoRazao(RAZAO, ['2026-01', '2026-02', '2026-03']))).toEqual([]);
    const pagouAMais = lerRazao([CAB, L('10/01/2026', '10503', 1000, 1000), L('10/02/2026', '10503', -1500, -500)]);
    expect(mesesDevedores(mesesDoRazao(pagouAMais, ['2026-01', '2026-02']))).toEqual(['2026-02']);
  });
});

describe('os contratos dentro do razão', () => {
  it('o número vem do histórico, de vários jeitos, sem os zeros da frente; datas e parcelas não contam', () => {
    expect([
      'Pagamento de Empréstimos Bancários - CCB n° 01098198 parc. 01/12', 'Pelo valor de empréstimos - doc. CCB n° 1098198',
      'Pagamento de Empréstimos Bancários - Capital de Giro n° Contrato 1246082 parc. 05/12', '01802448 DÉB.EMPRÉSTIMO',
      'Pelo valor de Encargos Financeiros doc. 1563830 Capital de Giro Sicoob', 'Pagamento de Empréstimos Bancários - ?', 'Pelo valor de Implantação de Saldos <12/2025>',
    ].map(numeroDoContrato)).toEqual(['1098198', '1098198', '1246082', '1802448', '1563830', null, null]);
  });
  it('soma cada contrato; o que pagou as parcelas todas e ainda tem saldo é apontado', () => {
    const H = (data: string, contra: string, valor: number, hist: string) => ['', '', data, '', contra, 'x', valor, '', hist, 0, ''];
    const r = lerRazao([CAB,
      H('10/01/2025', '10503', 3000, 'Pelo valor de empréstimos - doc. 1111111 Capital de Giro 3 parcelas'),
      H('10/02/2025', '10503', -1000, '01111111 DÉB.EMPRÉSTIMO'),
      H('10/03/2025', '10503', -1000, '01111111 DÉB.EMPRÉSTIMO'),
      H('10/04/2025', '10503', -1000, '01111111 DÉB.EMPRÉSTIMO'),
      H('01/05/2025', '10503', 5000, '2222222 CRÉD.EMPRÉSTIMO'),
      H('10/06/2025', '10503', -1000, 'Pagamento CCB 2222222 parc. 01/05'),
      // o encargo do contrato novo lançado com o número do antigo
      H('30/06/2025', '35001', 200, 'Pelo valor de Encargos Financeiros 1111111'),
      H('15/06/2025', '10503', -50, 'Pagamento de Empréstimos Bancários - ?'),
    ]);
    const c = contratosDoRazao(r);
    expect(c.contratos.map(x => [x.numero, x.liberado, x.pagas, x.parcelas, x.saldo, x.quitadoComSaldo])).toEqual([
      ['1111111', 3000, 3, 3, 200, true], ['2222222', 5000, 1, 5, 4000, false],
    ]);
    expect([c.semNumero.length, c.somaSemNumero]).toEqual([1, -50]);
    expect(c.contratos.some(k => k.completadoSemNumero)).toBe(false);
    // até o fim do período: o que vem depois não entra
    expect(contratosDoRazao(r, '2025-04').contratos.map(x => [x.numero, x.saldo])).toEqual([['1111111', 0]]);
  });
  it('os lançamentos sem número que zeram um contrato são dele (a implantação de saldo e as parcelas "?")', () => {
    const H = (data: string, valor: number, hist: string) => ['', '', data, '', '10503', 'x', valor, '', hist, 0, ''];
    const r = lerRazao([CAB,
      H('01/01/2020', 3000, 'Pelo valor de Implantação de Saldos'),
      H('06/03/2020', -1000, 'Pagamento de Empréstimos Bancários - 00901149'),
      H('06/04/2020', -2000, 'Pagamento de Empréstimos Bancários - ?'),
    ]);
    const c = contratosDoRazao(r);
    expect(c.contratos.map(k => [k.numero, k.saldo, k.completadoSemNumero])).toEqual([['901149', -1000, true]]);
  });
  it('vai para o Cadastro com o banco e os meses; nas outras competências, valem os do período e o banco vem pelos contratos', () => {
    const H = (data: string, valor: number, hist: string) => ['', '', data, '', '10503', 'x', valor, '', hist, 0, ''];
    const r = lerRazao([CAB,
      H('10/01/2025', 2000, 'Pelo valor de empréstimos - doc. 1111111 2 parcelas'), H('10/02/2025', -1000, '1111111 DÉB.EMPRÉSTIMO'), H('10/03/2025', -1000, '1111111 DÉB.EMPRÉSTIMO'),
      H('20/06/2025', 5000, '2222222 CRÉD.EMPRÉSTIMO'), H('20/07/2025', -1000, '2222222 DÉB.EMPRÉSTIMO'),
    ]);
    const cad = emprestimosParaOCadastro(contratosDoRazao(r).contratos, 'sicoob');
    expect(cad).toEqual([{ numero: '1111111', banco: 'sicoob', desde: '2025-01', ate: '2025-03' }, { numero: '2222222', banco: 'sicoob', desde: '2025-06' }]);
    expect(emprestimosNoPeriodo(cad, ['2025-04', '2025-05']).map(e => e.numero)).toEqual([]);
    expect(emprestimosNoPeriodo(cad, ['2025-03', '2025-04', '2025-05', '2025-06']).map(e => e.numero)).toEqual(['1111111', '2222222']);
    expect(emprestimosNoPeriodo(cad, ['2026-01']).map(e => e.numero)).toEqual(['2222222']);
    expect(bancoPelosContratos([{ numero: '2222222' }, { numero: '3333333' }], cad)).toBe('sicoob');
    expect(bancoPelosContratos([{ numero: '3333333' }], cad)).toBeNull();
  });
});
