// As provisões de cada conta, mês a mês, e os pagamentos que faltam (27/11/2026). Dados fictícios.
import { describe, expect, it } from 'vitest';
import { chaveDaProvisao, fechamentoDoPeriodo, ladoDaProvisao, planoComOBalancete, planoDoSci, pagamentosDasProvisoes, provisoesDaConta, type LancamentoDaConsulta } from './index';

const l = (data: string, debito: string, credito: string, valor: number, complemento = '', extra: Partial<LancamentoDaConsulta> = {}): LancamentoDaConsulta => ({
  data, debito, credito, valor, historico: '', complemento, documento: '', tipo: '', participanteD: '', participanteC: '', lancadoEm: '', alteradoEm: '', ...extra,
});

describe('as provisões da conta', () => {
  it('o lado da provisão pela classificação: o passivo no crédito, o a receber no débito, o disponível nenhum', () => {
    expect(ladoDaProvisao('02.1.1.03.001')).toBe('credito');
    expect(ladoDaProvisao('2.1.1')).toBe('credito');
    expect(ladoDaProvisao('01.1.2.01.001')).toBe('debito');
    expect(ladoDaProvisao('01.1.1.01.001')).toBeNull();
    expect(ladoDaProvisao('03.1.1.01.001')).toBeNull();
  });

  it('casa cada pagamento com a provisão do mesmo valor; o resto quita as mais antigas; os meses abertos ficam de fora', () => {
    const ls = [
      l('2026-08-31', '284', '200', 100000, 'Provisão de Impostos: 08/2026'),
      l('2026-09-30', '284', '200', 120000, 'Provisão de Impostos: 09/2026'),
      l('2026-10-31', '284', '200', 90000, 'Provisão de Impostos: 10/2026'),
      // o de setembro pago pelo valor igual, em outubro
      l('2026-10-20', '200', '12', 120000),
      // metade de agosto pelo caixa
      l('2026-09-20', '200', '5', 50000),
      l('2026-10-05', '5', '16', 999),
    ];
    const p = provisoesDaConta(ls, '200', '02.1.1.03.001')!;
    expect(p.lado).toBe('credito');
    expect(p.lancamentos).toHaveLength(5);
    expect(p.meses.map(m => [m.mes, m.provisionado, m.pago, m.aberto, m.situacao])).toEqual([
      ['2026-08', 100000, 50000, 50000, 'parcial'],
      ['2026-09', 120000, 120000, 0, 'pago'],
      ['2026-10', 90000, 0, 90000, 'aberto'],
    ]);
    expect(p.aberto).toBe(140000);
    expect(provisoesDaConta(ls, '5', '01.1.1.01.001')).toBeNull();
  });

  it('o pagamento sem provisão antes dele fica de fora (pago a mais)', () => {
    const p = provisoesDaConta([l('2026-08-10', '200', '5', 5000), l('2026-08-31', '284', '200', 5000)], '200', '02.1.1')!;
    expect(p.pagoSemProvisao).toBe(5000);
    expect(p.aberto).toBe(5000);
  });

  it('gera os pagamentos: pelo banco quando o extrato tem a saída do mesmo valor, senão pelo caixa no último dia do mês', () => {
    const ls = [
      l('2026-09-30', '284', '200', 120000, 'Provisão de Impostos: 09/2026', { participanteC: '77', documento: '9' }),
      l('2026-10-31', '284', '200', 90000, 'Provisão de Impostos: 10/2026'),
    ];
    const p = provisoesDaConta(ls, '200', '02.1.1.03.001')!;
    const g = pagamentosDasProvisoes(p.meses.flatMap(m => m.provisoes), {
      conta: '200', lado: 'credito', caixa: '5', banco: '12', historico: '30',
      extrato: [{ data: '2026-10-20', valor: -120000, historico: 'DAS' }, { data: '2026-09-01', valor: -90000, historico: 'antes da provisão' }],
    });
    expect(g.map(x => [x.pelo, x.lancamento.data, x.lancamento.debito, x.lancamento.credito, x.lancamento.valor])).toEqual([
      ['banco', '2026-10-20', '200', '12', 120000],
      // 31/10/2026 é sábado: o último dia útil, 30/10
      ['caixa', '2026-10-30', '200', '5', 90000],
    ]);
    expect(g[0].lancamento).toMatchObject({ historico: '30', participanteD: '77', documento: '9', complemento: '9 - Provisão de Impostos: 09/2026' });
    // sem documento na provisão, o mês dela
    expect(g[1].lancamento.documento).toBe('102026');
  });

  it('no a receber, o recebimento: D caixa (ou banco pela entrada) × C a conta, com o participante no crédito', () => {
    const p = provisoesDaConta([l('2026-10-05', '16', '265', 30000, '101 - CLIENTE', { participanteD: '900', documento: '101' })], '16', '01.1.2.01.001')!;
    const g = pagamentosDasProvisoes(p.meses[0].provisoes, { conta: '16', lado: 'debito', caixa: '5', historico: '477' });
    expect(g[0].lancamento).toMatchObject({ data: '2026-10-30', debito: '5', credito: '16', valor: 30000, participanteC: '900', complemento: '101 - CLIENTE' });
  });

  it('o fechamento: todas as contas no período, cada linha do extrato paga uma provisão só, o movimento do banco e do caixa', () => {
    const ls = [
      l('2026-09-30', '284', '200', 50000, 'Simples 09/2026'),
      l('2026-09-30', '300', '210', 50000, 'INSS 09/2026'),
      l('2026-09-15', '16', '265', 20000, 'Venda'),
      l('2025-12-31', '284', '200', 77700, 'fora do período'),
    ];
    const contas = [
      { codigo: '200', classificacao: '02.1.1.03.001', nome: 'Simples' },
      { codigo: '210', classificacao: '02.1.1.04.001', nome: 'INSS' },
      { codigo: '16', classificacao: '01.1.2.01.001', nome: 'Clientes' },
      { codigo: '5', classificacao: '01.1.1.01.001', nome: 'Caixa' },
    ];
    const f = fechamentoDoPeriodo(ls, contas, {
      caixa: '5', banco: '12', historicoPagamento: '30', historicoRecebimento: '477', de: '2026-01', ate: '2026-12',
      extrato: [{ data: '2026-10-20', valor: -50000, historico: 'DAS' }, { data: '2026-10-21', valor: -1234, historico: 'Tarifa' }],
    });
    // a saída de 500,00 paga o Simples; o INSS (mesmo valor) já não acha linha e vai pelo caixa
    expect(f.pagamentos.map(x => [x.conta.codigo, x.pelo, x.lancamento.historico])).toEqual([['200', 'banco', '30'], ['210', 'caixa', '30'], ['16', 'caixa', '477']]);
    expect(f.porConta.map(c => [c.conta.codigo, c.qtd, c.banco, c.caixa])).toEqual([['200', 1, 50000, 0], ['210', 1, 0, 50000], ['16', 1, 0, 20000]]);
    expect(f.movimentoNoBanco).toBe(-50000);
    expect(f.movimentoNoCaixa).toBe(-50000 + 20000);
    expect(f.extratoSemProvisao.map(e => e.historico)).toEqual(['Tarifa']);
  });

  it('o plano do nads com as contas do balancete do SCI: a conta nova entra, a do plano fica, o participante não', () => {
    const plano = planoDoSci('90113');
    const novo = planoComOBalancete(plano, { empresa: '', cnpj: '', inicio: '', fim: '', contas: [
      { classificacao: '01.1.1.02.099', codigo: '99999', nome: 'Banco Novo', analitica: true, anterior: 0, debito: 0, credito: 0, atual: 0 },
      { classificacao: '01.1.2.01.000000101', codigo: '99999', nome: 'CLIENTE', analitica: false, participante: true, anterior: 0, debito: 0, credito: 0, atual: 0 },
    ] });
    expect(plano.porCodigo.get('99999')).toBeUndefined();
    expect(novo.porCodigo.get('99999')).toMatchObject({ nome: 'Banco Novo', analitica: true });
    expect(novo.contas.length).toBe(plano.contas.length + 1);
  });

  // 27/11/2026, o Vitor: "recorra ao banco, se tem multa e juros"; o igual nunca é tomado pelo com acréscimo
  it('a multa e os juros: o extrato pagou a mais, a provisão paga e o acréscimo na conta de juros, na data do extrato', () => {
    const ls = [l('2026-09-30', '284', '200', 100000, 'DAS 09/2026'), l('2026-10-31', '284', '200', 105000, 'DAS 10/2026')];
    const p = provisoesDaConta(ls, '200', '02.1.1.03.001')!;
    const g = pagamentosDasProvisoes(p.meses.flatMap(m => m.provisoes), {
      conta: '200', lado: 'credito', caixa: '5', banco: '12', juros: '410', historico: '813',
      extrato: [{ data: '2026-11-05', valor: -105000, historico: 'DAS' }, { data: '2026-11-25', valor: -108000, historico: 'DAS com juros' }],
    });
    // o de 1.050,00 pega a linha igual; o de 1.000,00 pega a de 1.080,00 (multa e juros de 80,00)
    expect(g.map(x => [x.pelo, x.lancamento.data, x.lancamento.valor, x.acrescimo?.valor ?? 0, x.acrescimo?.debito ?? ''])).toEqual([
      ['banco', '2026-11-25', 100000, 8000, '410'],
      ['banco', '2026-11-05', 105000, 0, ''],
    ]);
    expect(g[0].acrescimo).toMatchObject({ credito: '12', historico: '813' });
  });

  it('o fechamento com o controle: deixar em aberto devolve a linha do extrato; sem caixa, o que não está no banco fica aberto', () => {
    const ls = [l('2026-09-30', '284', '200', 50000, 'A'), l('2026-10-31', '284', '200', 70000, 'B')];
    const contas = [{ codigo: '200', classificacao: '02.1.1', nome: 'Simples' }];
    const base = { caixa: '5', banco: '12', historicoPagamento: '813', historicoRecebimento: '478', de: '2026-01', ate: '2026-12', extrato: [{ data: '2026-10-20', valor: -50000, historico: 'DAS' }] };
    const deixar = new Set([chaveDaProvisao('200', ls[0])]);
    const f = fechamentoDoPeriodo(ls, contas, { ...base, deixarAbertas: deixar });
    expect(f.pagamentos.map(x => [x.lancamento.complemento, x.pelo])).toEqual([['102026 - B', 'caixa']]);
    expect(f.abertas.map(x => x.lancamento.complemento)).toEqual(['092026 - A']);
    expect(f.extratoSemProvisao).toHaveLength(1);
    const s2 = fechamentoDoPeriodo(ls, contas, { ...base, semCaixa: true });
    expect(s2.pagamentos.map(x => x.pelo)).toEqual(['banco']);
    expect(s2.abertas.map(x => x.pelo)).toEqual(['caixa']);
  });
});
