import { describe, expect, it } from 'vitest';
import { competenciaDeTrabalhoDoDp, reinfDoMes } from './prazosDoDp';

describe('a competência em trabalho no DP (21/10/2026)', () => {
  it('a do mês anterior até o 5º dia útil; depois, a do mês atual', () => {
    // outubro/2026: o 5º dia útil é 06/10 (01 qui, 02 sex, 03 sáb, 05 seg, 06 ter: o sábado conta, o domingo não)
    expect(competenciaDeTrabalhoDoDp(new Date(2026, 9, 1))).toBe('2026-09');
    expect(competenciaDeTrabalhoDoDp(new Date(2026, 9, 6, 18))).toBe('2026-09');
    expect(competenciaDeTrabalhoDoDp(new Date(2026, 9, 21))).toBe('2026-10');
    // janeiro: o anterior é dezembro do ano de antes
    expect(competenciaDeTrabalhoDoDp(new Date(2027, 0, 2))).toBe('2026-12');
    expect(competenciaDeTrabalhoDoDp(new Date(2027, 0, 20))).toBe('2027-01');
  });
});

describe('a REINF do mês no DP (21/10/2026: "fica como 19 sendo que não marcou nada")', () => {
  it('conta as transmitidas de quem tem a REINF, não só quem tem', () => {
    const clientes = [...Array.from({ length: 19 }, () => ({ temReinf: true, transmitida: false })), { temReinf: false, transmitida: false }];
    expect(reinfDoMes(clientes)).toEqual({ total: 19, feitas: 0, faltam: 19 });
    expect(reinfDoMes([{ temReinf: true, transmitida: true }, { temReinf: true, transmitida: false }, { temReinf: false, transmitida: true }])).toEqual({ total: 2, feitas: 1, faltam: 1 });
  });
});
