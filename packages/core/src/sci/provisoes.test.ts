// As provisões de cada conta, mês a mês, e os pagamentos que faltam (27/11/2026). Dados fictícios.
import { describe, expect, it } from 'vitest';
import { ladoDaProvisao, pagamentosDasProvisoes, provisoesDaConta, type LancamentoDaConsulta } from './index';

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
    expect(g[0].lancamento).toMatchObject({ historico: '30', participanteD: '77', documento: '9', complemento: 'Pagamento Provisão de Impostos: 09/2026' });
    // sem documento na provisão, o mês dela
    expect(g[1].lancamento.documento).toBe('102026');
  });

  it('no a receber, o recebimento: D caixa (ou banco pela entrada) × C a conta, com o participante no crédito', () => {
    const p = provisoesDaConta([l('2026-10-05', '16', '265', 30000, '101 - CLIENTE', { participanteD: '900' })], '16', '01.1.2.01.001')!;
    const g = pagamentosDasProvisoes(p.meses[0].provisoes, { conta: '16', lado: 'debito', caixa: '5', historico: '477' });
    expect(g[0].lancamento).toMatchObject({ data: '2026-10-30', debito: '5', credito: '16', valor: 30000, participanteC: '900', complemento: 'Recebimento 101 - CLIENTE' });
  });
});
