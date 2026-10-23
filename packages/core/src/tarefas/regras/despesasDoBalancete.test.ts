import { describe, expect, it } from 'vitest';
import type { BalanceteDinamico } from '../../extratudo/clientes';
import { despesasDoMes, rotuloDaDespesa } from './despesasDoBalancete';

const l = (classificacao: string, descricao: string, saldoAnterior: number, saldos: Record<string, number>) => ({ codigo: classificacao.replace(/\./g, ''), classificacao, descricao, saldoAnterior, saldos });

const d: BalanceteDinamico = {
  meses: ['2026-01', '2026-02'],
  linhas: [
    l('2', 'PASSIVO', 0, {}),
    l('2.1.1.02.001', 'FGTS a Recolher', -50, { '2026-01': -80, '2026-02': -90 }),
    l('4', 'CUSTOS E DESPESAS', 0, { '2026-01': 999, '2026-02': 999 }),
    l('4.2', 'DESPESAS ADMINISTRATIVAS', 0, { '2026-01': 999, '2026-02': 999 }),
    l('4.2.1.001', 'Água e Esgoto', 1200, { '2026-01': 100, '2026-02': 230 }),
    l('4.2.1.002', 'Energia Elétrica', 0, { '2026-01': 300, '2026-02': 300 }),
    l('4.2.1.003', 'FGTS', 0, { '2026-01': 80, '2026-02': 170.5 }),
    l('4.2.1.004', 'Material de escritório', 0, { '2026-01': 10, '2026-02': 25 }),
  ],
};

describe('as despesas do mês pelo balancete dinâmico (22/10/2026)', () => {
  it('o mês menos o anterior, só as analíticas de custos e despesas, com os destaques', () => {
    const r = despesasDoMes(d, '2026-02')!;
    expect(r.contas.map(c => [c.descricao, c.valor, c.rotulo])).toEqual([
      ['Água e Esgoto', 130, 'Água'], ['FGTS', 90.5, 'FGTS'], ['Material de escritório', 15, null],
    ]);
    expect(r.total).toBe(235.5);
    expect(r.destaques).toEqual([{ rotulo: 'FGTS', valor: 90.5 }, { rotulo: 'Água', valor: 130 }]);
  });
  it('em janeiro, o saldo que caiu é o ano que zerou: vale o saldo do mês', () => {
    const r = despesasDoMes(d, '2026-01')!;
    expect(r.contas.find(c => c.descricao === 'Água e Esgoto')?.valor).toBe(100);
    expect(r.contas.find(c => c.descricao === 'Energia Elétrica')?.valor).toBe(300);
  });
  it('o mês fora do dinâmico é null; os rótulos sem acento', () => {
    expect(despesasDoMes(d, '2026-03')).toBeNull();
    expect(despesasDoMes(null, '2026-01')).toBeNull();
    expect(rotuloDaDespesa('ALUGUEIS PAGOS')).toBe('Aluguel');
    expect(rotuloDaDespesa('Pró-labore')).toBe('Pró-labore');
  });
});
