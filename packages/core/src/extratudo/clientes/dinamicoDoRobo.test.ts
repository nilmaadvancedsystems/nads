import { describe, expect, it } from 'vitest';
import { dinamicoDoRobo, lerBalanceteDinamico } from './index';

const conta = (codigo: string, classificacao: string, anterior: number, anteriorDc: string, saldo: number, dc: string) => ({ codigo, classificacao, nome: 'C' + codigo, anterior, anteriorDc, saldo, dc });

describe('dinamicoDoRobo', () => {
  it('um mês: devedor positivo, credor negativo', () => {
    const { d, incertos } = dinamicoDoRobo([{ mes: '2025-11', contas: [conta('1', '1.1', 100, 'D', 150, 'D'), conta('2', '2.1', 50, 'C', 80, 'C')] }]);
    expect(d.meses).toEqual(['2025-11']);
    expect(d.linhas.map(l => [l.codigo, l.saldoAnterior, l.saldos['2025-11']])).toEqual([['1', 100, 150], ['2', -50, -80]]);
    expect(incertos).toBe(0);
  });

  it('vários meses, fora de ordem: a conta que falta num mês fica com o saldo anterior a ela', () => {
    const { d } = dinamicoDoRobo([
      { mes: '2025-12', contas: [conta('1', '1.1', 150, 'D', 200, 'D'), conta('3', '1.2', 30, 'D', 10, 'D')] },
      { mes: '2025-11', contas: [conta('1', '1.1', 100, 'D', 150, 'D')] },
    ]);
    expect(d.meses).toEqual(['2025-11', '2025-12']);
    expect(d.linhas.find(l => l.codigo === '3')!.saldos).toEqual({ '2025-11': 30, '2025-12': 10 });
  });

  it('ordena pela classificação numérica e conta os sinais incertos', () => {
    const { d, incertos } = dinamicoDoRobo([{ mes: '2025-11', contas: [{ ...conta('9', '1.10', 0, 'D', 5, 'C'), dcIncerto: true }, conta('8', '1.2', 0, 'D', 1, 'D')] }]);
    expect(d.linhas.map(l => l.classificacao)).toEqual(['1.2', '1.10']);
    expect(incertos).toBe(1);
  });

  it('tem o mesmo formato do dinâmico importado à mão', () => {
    const manual = lerBalanceteDinamico([['Código', 'Classificação', 'Descrição', 'Saldo Anterior', '11/2025'], ['1', '1.1', 'CAIXA', '100', '150']]);
    const { d } = dinamicoDoRobo([{ mes: '2025-11', contas: [{ ...conta('1', '1.1', 100, 'D', 150, 'D'), nome: 'CAIXA' }] }]);
    expect(d).toEqual(manual);
  });
});
