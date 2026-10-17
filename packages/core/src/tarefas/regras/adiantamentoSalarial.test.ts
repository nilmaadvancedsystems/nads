import { describe, expect, it } from 'vitest';
import { conferirAdiantamentoSalarial, dataDoAdiantamentoSalarial } from './adiantamentoSalarial';
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
