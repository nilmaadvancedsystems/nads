// Testes combinatórios do Financeiro: a calculadora, as contas do caixa por mês e por conta e o reajuste. Dados inventados.
import { describe, expect, it } from 'vitest';
import { CALCULADORA_INICIAL, calcular, resultadoEmReais, type TeclaDaCalculadora } from './calculadora';
import { valorReajustado } from './gestao';
import type { ContaDoPlano, LancamentoDeCaixa } from './index';
import { caixaPorMes, saldoDeHoje, totaisPorConta, ultimosMeses } from './painel';

const digitar = (s: string) => [...s].reduce((e, c) => calcular(e, (c === ',' ? { tipo: 'virgula' } : { tipo: 'digito', digito: c }) as TeclaDaCalculadora), CALCULADORA_INICIAL);
const cent = (n: number) => Math.round(n * 100) / 100;

describe('a calculadora do Caixa', () => {
  it.each([['1,005', 1.01], ['1,015', 1.02], ['1,025', 1.03], ['8,345', 8.35], ['10,075', 10.08], ['0,005', 0.01], ['0,004', 0], ['1234,565', 1234.57]])('%s vai em centavos como %d', (v, n) => {
    expect(resultadoEmReais(digitar(v))).toBe(n);
  });

  it('negativo arredonda para o mesmo lado do positivo', () => {
    expect(resultadoEmReais(calcular(digitar('1,005'), { tipo: 'sinal' }))).toBe(-1.01);
  });

  it('0,1 + 0,2 dá 0,3, e divisão por zero leva zero para o lançamento', () => {
    let e = digitar('0,1');
    e = calcular(e, { tipo: 'operador', operador: '+' });
    for (const c of '0,2') e = calcular(e, (c === ',' ? { tipo: 'virgula' } : { tipo: 'digito', digito: c }) as TeclaDaCalculadora);
    e = calcular(e, { tipo: 'igual' });
    expect(e.visor).toBe('0,3');
    let z = digitar('5');
    z = calcular(z, { tipo: 'operador', operador: '/' });
    z = calcular(z, { tipo: 'digito', digito: '0' });
    z = calcular(z, { tipo: 'igual' });
    expect(z.erro).toBe(true);
    expect(resultadoEmReais(z)).toBe(0);
  });
});

describe('o caixa por mês e por conta', () => {
  const lanc = (data: string, valor: number, tipo: 'E' | 'S', conta?: string, id = data + valor) => ({ id, data, descricao: 'x', valor, tipo, conta, origem: 'manual', criadoEm: '', criadoPor: '' }) as unknown as LancamentoDeCaixa;
  const planos = new Map<string, ContaDoPlano>(['a', 'b', 'c'].map(id => [id, { id, codigo: id, descricao: id, tipo: 'despesa', nivel: 3 } as unknown as ContaDoPlano]));

  it('os 12 meses atravessam a virada do ano', () => {
    expect(ultimosMeses('2026-02-10', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(ultimosMeses('2026-12-31', 12)[0]).toBe('2026-01');
  });

  it('nenhum centavo com erro, e a ordem dos lançamentos não importa', () => {
    const base: LancamentoDeCaixa[] = [];
    for (let i = 1; i <= 300; i++) base.push(lanc('2026-0' + ((i % 3) + 1) + '-1' + (i % 9), cent(((i * 7.77) % 1000) + 0.01), i % 4 ? 'E' : 'S', ['a', 'b', 'x', undefined][i % 4], String(i)));
    const meses = ['2026-01', '2026-02', '2026-03'];
    const r = caixaPorMes(base, meses);
    const r2 = caixaPorMes([...base].reverse(), meses);
    expect(r2).toEqual(r);
    for (const m of r) {
      expect(m.resultado).toBe(cent(m.entradas - m.saidas));
      expect(m.entradas).toBe(cent(m.entradas));
    }
    expect(saldoDeHoje(base, '2026-12-31')).toBe(cent(r.reduce((t, m) => t + m.resultado, 0)));
  });

  it('a soma por conta é o total, nada entra duas vezes, inclusive com as "Outras contas"', () => {
    const base: LancamentoDeCaixa[] = [];
    for (let i = 1; i <= 50; i++) base.push(lanc('2026-01-10', cent(i * 0.07), 'S', i % 2 ? 'a' : i % 3 ? 'b' : undefined, String(i)));
    const esperado = cent(base.reduce((t, l) => t + l.valor, 0));
    for (const limite of [1, 2, 3, 8]) {
      const t = totaisPorConta(base, 'S', '2026-01-01', '2026-01-31', planos, limite);
      expect(cent(t.reduce((s, x) => s + x.total, 0))).toBe(esperado);
      expect(t.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 0);
    }
  });

  it('as pontas do período entram e o dia seguinte não', () => {
    const ls = [lanc('2026-01-01', 1, 'E', 'a'), lanc('2026-01-31', 2, 'E', 'a'), lanc('2026-02-01', 4, 'E', 'a')];
    expect(totaisPorConta(ls, 'E', '2026-01-01', '2026-01-31', planos)[0].total).toBe(3);
    expect(saldoDeHoje(ls, '2026-01-31')).toBe(3);
  });
});

describe('o reajuste', () => {
  it.each([[1000, 4.5, 'centavo', 1045], [100.1, 10, 'centavo', 110.11], [100.1, 10, 'real', 111], [101, 0, 'cinco', 105], [100, 0, 'cinco', 100], [0.01, 50, 'centavo', 0.02]] as const)('%d com %d%% (%s) → %d', (v, p, a, n) => {
    expect(valorReajustado(v, p, a)).toBe(n);
  });
});
