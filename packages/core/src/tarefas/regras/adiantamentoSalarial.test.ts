import { describe, expect, it } from 'vitest';
import { conferirAdiantamentoSalarial, dataDoAdiantamentoSalarial, pagamentosQueFaltam } from './adiantamentoSalarial';
import { lerRazao } from './razao';

// valores e nomes inventados
const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const L = (data: string, valor: number, hist: string, saldo: number) => ['', '', data, '', '52001', 'Salários a Pagar', valor, '', hist, saldo, ''];

describe('o adiantamento salarial (16/10/2026)', () => {
  it('o dia 15, ou o dia útil antes dele', () => {
    expect(dataDoAdiantamentoSalarial('2026-07')).toBe('2026-07-15'); // quarta
    expect(dataDoAdiantamentoSalarial('2026-08')).toBe('2026-08-14'); // 15 é sábado
    expect(dataDoAdiantamentoSalarial('2026-11')).toBe('2026-11-13'); // 15 é domingo (e feriado)
  });
  it('o mês pago no dia zera; o mês sem o pagamento fica credor, com o que falta', () => {
    const r = lerRazao([CAB,
      L('15/07/2026', -2475, 'Pagamento de adiantamento salarial 07/2026', -2475),
      L('31/07/2026', 2475, 'Pelo valor do adiantamento descontado em folha <07/2026>', 0),
      L('31/08/2026', 2600, 'Pelo valor do adiantamento descontado em folha <08/2026>', 2600),
    ]);
    expect(conferirAdiantamentoSalarial(r, ['2026-07', '2026-08']).map(m => [m.mes, m.provisao, m.pagamentos.map(p => p.data), m.saldoFinal, m.falta, m.dataEsperada])).toEqual([
      ['2026-07', 2475, ['2026-07-15'], 0, 0, '2026-07-15'],
      ['2026-08', 2600, [], 2600, 2600, '2026-08-14'],
    ]);
  });
});

describe('o que falta pagar para zerar (Vitor, 26/10/2026)', () => {
  // o razão como o Alterdata: o desconto na folha a crédito no fim do mês, o pagamento a débito no dia 15
  const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', ''];
  let saldo = 0;
  const L = (data: string, valor: number) => { saldo = Math.round((saldo + valor) * 100) / 100; return ['', '', data, '', '52001', 'Salários a Pagar', valor, '92050', 'adiantamento', saldo, '']; };
  const r = lerRazao([CAB,
    L('31/01/2026', 26.5), L('31/01/2026', 800), L('31/01/2026', 1500), L('31/01/2026', 1820), // janeiro: 4.146,50, sem pagamento
    L('15/02/2026', -4095), L('28/02/2026', 850), L('28/02/2026', 1300), L('28/02/2026', 1945), // fevereiro: pago no dia 15
    L('31/03/2026', 1000), // março: sem pagamento
    L('15/04/2026', -1000), // o de março pago com atraso, em abril
  ]);
  it('cada mês com o desconto sem pagamento vira o lançamento no dia 15 dele, também antes dos meses da etapa', () => {
    expect(pagamentosQueFaltam(r, '2026-08')).toEqual([
      { mes: '2026-01', data: '2026-01-15', valor: 4146.5, historico: 'Pagamento de adiantamento salarial 01/2026' },
    ]);
    // a etapa só em junho a agosto: o saldo vem de janeiro, e o que falta também
    expect(conferirAdiantamentoSalarial(r, ['2026-06']).map(m => [m.saldoFinal, m.falta])).toEqual([[4146.5, 0]]);
  });
});
