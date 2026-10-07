import { describe, expect, it } from 'vitest';
import type { Nota } from '../../conferencia/tipos';
import { bensDoPeriodo, ncmDeBem, notasDeBensDeTeste, tipoDoCfopDeBem } from './bens';

const nota = (cfop: string, numero: string, valor: number, comp = '2026-08', extra: Partial<Nota> = {}): Nota =>
  ({ cfop, lanc: '', valor, numero, nome: 'FORNECEDOR ' + numero, data: '10/' + comp.slice(5) + '/' + comp.slice(0, 4), desc: '', comp, ...extra });

describe('etapa Bens', () => {
  it('CFOPs de bem: entrada e saída, pelos três últimos dígitos', () => {
    expect(tipoDoCfopDeBem('1551')?.efeito).toBe('entra');
    expect(tipoDoCfopDeBem('2.551')?.efeito).toBe('entra');
    expect(tipoDoCfopDeBem('3551')?.efeito).toBe('entra');
    expect(tipoDoCfopDeBem('2406')?.rotulo).toMatch(/ST/);
    expect(tipoDoCfopDeBem('1555')?.efeito).toBe('nao-mexe');
    expect(tipoDoCfopDeBem('5551')?.efeito).toBe('sai');
    expect(tipoDoCfopDeBem('6553')?.efeito).toBe('sai');
    expect(tipoDoCfopDeBem('1102')).toBeNull();
    expect(tipoDoCfopDeBem('5102')).toBeNull();
    expect(tipoDoCfopDeBem('1556')).toBeNull();
  });

  it('NCM de bem', () => {
    expect(ncmDeBem('8703.23.10')).toBe(true);
    expect(ncmDeBem('84713012')).toBe(true);
    expect(ncmDeBem('94033000')).toBe(true);
    expect(ncmDeBem('48201000')).toBe(false);
    expect(ncmDeBem('')).toBe(false);
  });

  it('só os meses da tarefa; os itens da mesma nota juntos; os totais do que entra e do que sai', () => {
    const entradas = [
      nota('2551', '10', 1000, '2026-08', { ncm: '87042310' }), nota('2551', '10', 500.5, '2026-08', { ncm: '87089990' }),
      nota('1551', '11', 300), nota('1555', '12', 900), nota('1102', '13', 50), nota('1551', '14', 70, '2026-07'),
      nota('1556', '15', 4380, '2026-08', { ncm: '94033000' }), nota('1556', '16', 99, '2026-08', { ncm: '48201000' }),
    ];
    const saidas = [nota('5551', '20', 32000), nota('5102', '21', 10)];
    const b = bensDoPeriodo(entradas, saidas, ['2026-08']);
    expect(b.entradas.map(n => [n.numero, n.valor, n.efeito, n.ncms])).toEqual([
      ['10', 1500.5, 'entra', ['87042310', '87089990']], ['11', 300, 'entra', []], ['12', 900, 'nao-mexe', []],
    ]);
    expect(b.saidas.map(n => n.numero)).toEqual(['20']);
    expect(b.usoEConsumo.map(n => n.numero)).toEqual(['15']);
    expect(b.totais).toEqual({ entram: 1800.5, saem: 32000 });
  });

  it('as notas de teste do ⚡ passam por todos os casos', () => {
    const t = notasDeBensDeTeste(['2026-08']);
    const b = bensDoPeriodo(t.entradas, t.saidas, ['2026-08']);
    expect([b.entradas.length, b.saidas.length, b.usoEConsumo.length]).toEqual([2, 1, 1]);
  });
});
