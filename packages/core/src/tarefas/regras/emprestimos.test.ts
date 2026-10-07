import { describe, expect, it } from 'vitest';
import { bancoDoRazao, mesesDevedores } from './emprestimos';
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
