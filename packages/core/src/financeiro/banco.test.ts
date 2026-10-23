import { describe, expect, it } from 'vitest';
import { contaDoPlanoParaOBanco, identificarExtrato, linhasDoExtrato, resumoDoExtrato, saldoFinalDoExtrato, saldosNoBanco, type ImportacaoDeExtrato } from './banco';

describe('o extrato do banco no Financeiro (23/10/2026)', () => {
  const lidas = [
    { data: '2026-10-01', valor: 150000, historico: 'PIX RECEBIDO  CLIENTE' },
    { data: '2026-10-02', valor: -2590, historico: 'TARIFA' },
    { data: '2026-10-02', valor: -2590, historico: 'TARIFA' },
    { data: '2026-10-03', valor: 0, historico: 'SALDO' },
  ];
  it('as linhas: o tipo pelo sinal, o valor em reais, sem as de valor zero, e o id fixo (as iguais pela ordem)', () => {
    const a = linhasDoExtrato(lidas, 'Sicoob', 'imp1');
    expect(a.map(l => [l.tipo, l.valor, l.historico])).toEqual([['E', 1500, 'PIX RECEBIDO CLIENTE'], ['S', 25.9, 'TARIFA'], ['S', 25.9, 'TARIFA']]);
    expect(new Set(a.map(l => l.id)).size).toBe(3);
    // importar de novo (outra importação) dá os mesmos ids: não duplica
    expect(linhasDoExtrato(lidas, 'Sicoob', 'imp2').map(l => l.id)).toEqual(a.map(l => l.id));
    // outro banco, outros ids
    expect(linhasDoExtrato(lidas, 'Efí', 'imp3')[0].id).not.toBe(a[0].id);
  });
  it('o resumo e o saldo final', () => {
    const a = linhasDoExtrato(lidas, 'Sicoob', 'imp1');
    expect(resumoDoExtrato(a)).toEqual({ de: '2026-10-01', ate: '2026-10-02', quantos: 3, entradas: 1500, saidas: 51.8 });
    expect(saldoFinalDoExtrato(lidas, 10000)).toBe(1548.2);
    expect(saldoFinalDoExtrato(lidas, undefined, [{ data: '2026-10-02', saldo: 99900 }, { data: '2026-10-01', saldo: 5 }])).toBe(999);
    expect(saldoFinalDoExtrato(lidas)).toBeUndefined();
  });
  it('o saldo de cada banco é o do extrato que vai mais longe', () => {
    const i = (id: string, banco: string, ate: string, saldoFinal?: number): ImportacaoDeExtrato =>
      ({ id, banco, arquivo: 'x', de: '2026-10-01', ate, quantos: 1, entradas: 0, saidas: 0, saldoFinal, importadoEm: '2026-10-23T10:00:00Z', importadoPor: 'X' });
    expect(saldosNoBanco([i('1', 'Sicoob', '2026-09-30', 10), i('2', 'Sicoob', '2026-10-20', 20), i('3', 'Efí', '2026-10-21'), i('4', 'Efí', '2026-10-10', 5)]))
      .toEqual([{ banco: 'Efí', saldo: 5, ate: '2026-10-10' }, { banco: 'Sicoob', saldo: 20, ate: '2026-10-20' }]);
  });
});

describe('de quem é o extrato (23/10/2026)', () => {
  const contas = [
    { id: 'sicoob-3144-123456', marca: 'sicoob', nome: 'Sicoob', agencia: '3144', conta: '12.345-6' },
    { id: 'efi-1-998877', marca: 'efi', nome: 'Efí', agencia: '0001', conta: '998877-1' },
  ];
  it('acha o banco, a conta do Cadastro e se é da Nilma', () => {
    const a = identificarExtrato('SICOOB - EXTRATO  Cooperado: NILMA CONTABILIDADE LTDA  Conta: 12.345-6  Período 01/10/2026', contas);
    expect(a).toEqual({ marca: 'sicoob', daNilma: true, conta: contas[0] });
    const b = identificarExtrato('Efí S.A. Instituição de Pagamento  Titular NILMA DIAS  Conta 0998877-1', contas);
    expect(b.marca).toBe('efi');
    expect(b.conta?.id).toBe('efi-1-998877');
  });
  it('de outra pessoa: não é da Nilma e a conta não bate', () => {
    const c = identificarExtrato('SICOOB  Cooperado: JOAO DA SILVA  Conta: 55.555-5', contas);
    expect(c.daNilma).toBe(false);
    expect(c.conta).toBeNull();
    expect(identificarExtrato('', contas)).toEqual({ marca: null, daNilma: null, conta: null });
    // um valor em reais igual ao número da conta não identifica a conta
    expect(identificarExtrato('SICOOB NILMA CONTABILIDADE  Conta 77.777-7  Saldo R$ 12.345,60', contas).conta).toBeNull();
  });
  it('a conta do plano: a que já existe pela descrição, ou a próxima do Ativo Circulante', () => {
    const plano = [
      { id: 'p1', codigo: '1', descricao: 'ATIVO', tipo: 'ATIVO', nivel: 1, pai: null, ativo: true, movimentavel: false },
      { id: 'p11', codigo: '1.1', descricao: 'Ativo Circulante', tipo: 'ATIVO', nivel: 2, pai: 'p1', ativo: true, movimentavel: false },
      { id: 'p3', codigo: '1.1.01', descricao: 'Caixa', tipo: 'ATIVO', nivel: 3, pai: 'p11', ativo: true, movimentavel: true },
      { id: 'p4', codigo: '1.1.02', descricao: 'Bancos Conta Movimento', tipo: 'ATIVO', nivel: 3, pai: 'p11', ativo: true, movimentavel: true },
    ];
    expect(contaDoPlanoParaOBanco(plano, 'Sicoob C/C 12.345-6')).toEqual({ existe: false, codigo: '1.1.03', descricao: 'Sicoob C/C 12.345-6', pai: 'p11', nivel: 3 });
    expect(contaDoPlanoParaOBanco([...plano, { ...plano[3], id: 'p5', codigo: '1.1.03', descricao: 'Sicoob C/C 12.345-6' }], 'sicoob c/c 12.345-6')).toEqual({ existe: true, id: 'p5', codigo: '1.1.03' });
  });
});
