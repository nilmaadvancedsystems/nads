import { describe, expect, it } from 'vitest';
import { lerRazao } from '../../tarefas/regras/razao';
import { chaveDoItem, comLancamentoDigitado, definirItem, semLancamentoDigitado, conferirRazaoDoCliente, itensEscolhidos, linhasParaOTicket, observacaoDoRazao, razaoDaMarca, rotuloDoItem } from './razao';
import { situacaoDe, textoDaMensagem, textoDasNotas } from './index';

// o formato do razão da conciliação do Alterdata (conta de um cliente), com valores inventados
const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
let saldo = 0;
const L = (data: string, contra: string, nome: string, valor: number, hist: string, conta = true) => {
  if (conta) saldo = Math.round((saldo + valor) * 100) / 100;
  return ['Falso', 'Conciliação manual', data, '', contra, nome, valor, '', hist, saldo, ''];
};
const CNPJ = '11222333000144-CLIENTE TESTE LTDA';
const ROWS = [CAB,
  // NF 100: vendida e recebida em duas parcelas (fecha)
  L('05/07/2026', '96504', 'Venda de Produção', -800, 'Pelas vendas de produtos conf. Nf-e ? - 100-' + CNPJ),
  L('05/07/2026', '96501', 'Vendas de Mercadorias', -200, 'Pelas vendas de mercadorias a prazo conforme Nota Fiscal Eletronica n°  - 100-' + CNPJ),
  L('20/07/2026', '10503', 'Banco', 500, 'Recebimento de clientes  100 -DUP.001 -' + CNPJ),
  L('27/07/2026', '10503', 'Banco', 500, 'Recebimento de clientes 100/002 - CLIENTE TESTE LTDA'),
  // NF 101: recebida a menos (fica 150,00 em aberto) e uma devolução sem nota
  L('10/07/2026', '96504', 'Venda de Produção', -1000, 'Pelas vendas de produtos conf. Nf-e ? - 101-' + CNPJ),
  L('12/07/2026', '60501', '(-) Devolução de vendas', 90, 'Pelo valor de devolução de vendas de mercadorias/produtos conf NF-e ? - 5555-' + CNPJ + '//NF: 99,101'),
  L('30/07/2026', '10503', 'Banco', 850, 'Recebimento de clientes 101/001 - CLIENTE TESTE LTDA'),
  // NF 102: recebida no Caixa e no Banco no mesmo dia (duplicidade: o saldo do Alterdata conta uma vez)
  L('01/08/2026', '96504', 'Venda de Produção', -300, 'Pelas vendas de produtos conf. Nf-e ? - 102-' + CNPJ),
  L('15/08/2026', '10101', 'Caixa Geral', 300, 'Recebimento de clientes  102 -DUP.001 -' + CNPJ),
  L('15/08/2026', '10503', 'Banco', 300, 'Recebimento de clientes  102 - CLIENTE TESTE LTDA', false),
  // NF 103: vendida em agosto, nada recebido
  L('20/08/2026', '96501', 'Vendas de Mercadorias', -420.5, 'Pelas vendas de mercadorias a prazo conforme Nota Fiscal Eletronica n°  - 103-' + CNPJ),
  // setembro: fora do mês
  L('05/09/2026', '96501', 'Vendas de Mercadorias', -999, 'Pelas vendas de mercadorias a prazo conforme Nota Fiscal Eletronica n°  - 104-' + CNPJ),
];

describe('o razão do cliente', () => {
  const r = conferirRazaoDoCliente(lerRazao(ROWS), '2026-08');
  it('acha as notas que o pagamento não fechou, até o fim do mês', () => {
    expect(r.emAberto.map(n => [n.nf, n.aberto])).toEqual([['101', 150], ['103', 420.5]]);
    expect(r.aMais).toEqual([]);
  });
  it('a duplicidade conta uma vez e aparece; a devolução abate e diz as notas citadas', () => {
    expect(r.duplicados.map(d => [d.nf, d.valor, d.contas.length])).toEqual([['102', 300, 2]]);
    expect(r.devolucoes.map(d => [d.nf, d.valor, d.notas])).toEqual([['5555', 90, ['99', '101']]]);
  });
  it('o saldo achado bate com a coluna Saldo do razão no fim do mês', () => {
    expect(r.saldo).toBe(480.5);
    expect(r.saldoDoRazao).toBe(480.5);
  });
  it('as notas vão para a relação do cliente', () => {
    const m = razaoDaMarca('razao.xls', r);
    expect(textoDasNotas(m.notas)).toBe('NF 101 (R$ 150,00), NF 103 (R$ 420,50)');
    expect(textoDaMensagem('{lista}', 'E', '08/2026', [{ codigo: '1', nome: 'CLIENTE TESTE', saldo: 480.5, obs: '', notas: m.notas }]))
      .toBe('• CLIENTE TESTE — R$ 480,50 — em aberto: NF 101 (R$ 150,00), NF 103 (R$ 420,50)');
  });
});

describe('a relação e a observação pronta', () => {
  const r = conferirRazaoDoCliente(lerRazao(ROWS), '2026-08');
  const m = razaoDaMarca('razao.xls', r);
  it('a relação em ordem de data: notas em aberto, devolução e duplicidade', () => {
    expect(m.itens.map(i => [i.data, i.valor, i.status])).toEqual([['2026-07-10', 150, 'aberto'], ['2026-07-12', -90, 'devolucao'], ['2026-08-15', 300, 'pagamento'], ['2026-08-20', 420.5, 'aberto']]);
    expect([m.itens[0].nf, m.itens[0].descricao]).toEqual(['101', 'Venda a prazo (vendido R$ 1.000,00, recebido R$ 850,00)']);
    expect(m.itens.filter(i => i.interno).map(i => i.nf)).toEqual(['102']);
  });
  it('a observação: no meu sistema, está em aberto', () => {
    expect(observacaoDoRazao(m)).toBe('No meu sistema, estão em aberto: 10/07/2026 - NF 101 - R$ 150,00; 20/08/2026 - NF 103 - R$ 420,50');
  });
});

describe('o pagamento solto', () => {
  it('a transferência sem a nota entra como apenas pagamento e abate o saldo', () => {
    const C = '11222333000144-CLIENTE TESTE LTDA';
    const linhas = [CAB,
      ['Falso', '', '05/08/2026', '', '96501', 'Vendas', -100, '', 'Pelas vendas de mercadorias a prazo conforme Nota Fiscal Eletronica n°  - 300-' + C, -100, ''],
      ['Falso', '', '20/08/2026', '', '10503', 'Banco', 40, '', 'TRANSFERENCIA PIX CLIENTE TESTE', -60, ''],
    ];
    const r = conferirRazaoDoCliente(lerRazao(linhas), '2026-08');
    expect(r.saldo).toBe(60);
    expect(razaoDaMarca('x.xls', r).itens.map(i => [i.status, i.valor, i.conta || ''])).toEqual([['aberto', 100, ''], ['pagamento', -40, 'Banco']]);
  });
});

describe('o razão zerado', () => {
  it('dá o Ok do sistema, mesmo com saldo no dinâmico', () => {
    const C = '11222333000144-CLIENTE TESTE LTDA';
    const linhas = [CAB,
      ['Falso', '', '05/08/2026', '', '96501', 'Vendas', -100, '', 'Pelas vendas de mercadorias a prazo conforme Nota Fiscal Eletronica n°  - 300-' + C, -100, ''],
      ['Falso', '', '20/08/2026', '', '10503', 'Banco', 100, '', 'Recebimento de clientes 300 - CLIENTE TESTE', 0, ''],
    ];
    const razao = razaoDaMarca('x.xls', conferirRazaoDoCliente(lerRazao(linhas), '2026-08'));
    const conta = { codigo: '1', nome: 'CLIENTE TESTE', saldo: 100, noBalancete: null };
    expect(situacaoDe(conta, { nome: 'CLIENTE TESTE', saldo: 100, situacao: 'conferido', razao })).toBe('ok');
    // sem o razão, o conferido marcado à mão não vale (Vitor, 07/10/2026)
    expect(situacaoDe(conta, { nome: 'CLIENTE TESTE', saldo: 100, situacao: 'conferido' })).toBe('pendente');
  });
});

describe('o que vai para o cliente: o + de cada linha (07/10/2026)', () => {
  const item = (nf: string, valor: number, status: 'aberto' | 'pagamento' | 'devolucao' = 'aberto', interno = false) =>
    ({ data: '2026-08-05', nf, descricao: '', valor, status, ...(interno ? { interno } : {}) });
  const razao = { arquivo: 'x.xls', notas: [], saldo: 0, devolucoes: 0, duplicadas: [], itens: [item('9971', 839.33), item('10111', 1514.65), item('', -200, 'pagamento'), item('9971', 839.33, 'pagamento', true)] };
  const [a, b, c, dup] = razao.itens.map(chaveDoItem);
  it('sem nada adicionado, nada vai', () => {
    expect(itensEscolhidos(razao)).toEqual([]);
    expect(itensEscolhidos(razao, [])).toEqual([]);
  });
  it('o + adiciona só a linha, na ordem do razão; o × tira; tirar a última volta a nada', () => {
    const umaa = definirItem(razao, undefined, b, true);
    expect(umaa).toEqual([b]);
    const duas = definirItem(razao, umaa, a, true);
    expect(duas).toEqual([a, b]);
    expect(itensEscolhidos(razao, duas).map(rotuloDoItem)).toEqual(['NF 9971', 'NF 10111']);
    expect(definirItem(razao, [c], c, false)).toBeUndefined();
    // a duplicidade é só do escritório: não entra
    expect(definirItem(razao, umaa, dup, true)).toEqual([b]);
    // a chave que não existe mais (o razão mudou) sai sozinha
    expect(itensEscolhidos(razao, ['velha', b]).map(rotuloDoItem)).toEqual(['NF 10111']);
    expect(rotuloDoItem(razao.itens[2])).toBe('Pagamento 05/08/2026');
  });
  it('o ticket leva só o adicionado', () => {
    expect(linhasParaOTicket(razao, 0, '2026-08', [b, c]).map(l => l.nf)).toEqual(['10111', '—']);
    // a operação pelo lado da conta (Vitor, 08/10/2026): a nota do cliente é Venda; a do fornecedor, Compra
    expect(linhasParaOTicket(razao, 0, '2026-08', [b]).map(l => l.operacao)).toEqual(['Venda']);
    expect(linhasParaOTicket(razao, 0, '2026-08', [b], 'fornecedores').map(l => l.operacao)).toEqual(['Compra']);
    expect(linhasParaOTicket(undefined, 10, '2026-08', undefined, 'fornecedores').map(l => [l.tipo, l.operacao])).toEqual([['saldo', 'Compra']]);
  });
});

describe('o lançamento digitado à mão (08/10/2026)', () => {
  it('sem razão: vira a relação só de digitados, com o sinal da relação e a nota em aberto nas notas', () => {
    const r = comLancamentoDigitado(undefined, { data: '2026-08-05', nf: ' 9971 ', descricao: '', valor: 839.33, status: 'aberto' }, 2353.98);
    expect(r).toMatchObject({ manual: true, saldo: 2353.98, notas: [{ nf: '9971', data: '2026-08-05', aberto: 839.33 }] });
    expect(r.itens[0]).toEqual({ data: '2026-08-05', nf: '9971', descricao: 'Em aberto', valor: 839.33, status: 'aberto', digitado: true });
    const r2 = comLancamentoDigitado(r, { data: '2026-08-01', nf: '', descricao: 'PIX', valor: 100, status: 'pagamento' }, 0);
    expect(r2.itens.map(i => i.valor)).toEqual([-100, 839.33]);
    // tira um; tirar o último tira a relação
    const r3 = semLancamentoDigitado(r2, chaveDoItem(r2.itens[1]));
    expect(r3?.notas).toEqual([]);
    expect(semLancamentoDigitado(r3, chaveDoItem(r3!.itens[0]))).toBeUndefined();
  });
  it('no razão importado: entra junto, e tirar não mexe no que veio do arquivo', () => {
    const imp = { arquivo: 'x.xls', notas: [], saldo: 50, devolucoes: 0, duplicadas: [], itens: [{ data: '2026-08-02', nf: '1', descricao: 'Venda a prazo', valor: 50, status: 'aberto' as const }] };
    const r = comLancamentoDigitado(imp, { data: '2026-08-09', nf: '', descricao: '', valor: 20, status: 'devolucao' }, 0);
    expect(r.manual).toBeUndefined();
    expect(r.itens.length).toBe(2);
    expect(semLancamentoDigitado(r, chaveDoItem(imp.itens[0]))).toBe(r);
    expect(semLancamentoDigitado(r, chaveDoItem(r.itens[1]))?.itens.length).toBe(1);
  });
});
