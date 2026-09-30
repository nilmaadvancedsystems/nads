import { describe, expect, it } from 'vitest';
import { filtroDoPeriodo, noPeriodo } from './periodo';

describe('filtro do período (a Conferência dentro da etapa)', () => {
  it('um mês: os dias dele e o mês marcado', () => {
    expect(filtroDoPeriodo(['2026-02'])).toMatchObject({ meses: ['2026-02'], dataDe: '01/02/2026', dataAte: '28/02/2026' });
  });
  it('o período do Em Lote: do primeiro dia do primeiro mês ao último do último, na ordem', () => {
    const f = filtroDoPeriodo(['2026-08', '2026-06', '2026-07', '2026-06']);
    expect(f).toMatchObject({ meses: ['2026-06', '2026-07', '2026-08'], dataDe: '01/06/2026', dataAte: '31/08/2026', busca: '' });
    expect(noPeriodo({ data: '15/07/2026', comp: '2026-07' }, f)).toBe(true);
    expect(noPeriodo({ data: '01/09/2026', comp: '2026-09' }, f)).toBe(false);
  });
  it('sem mês válido: o filtro vazio', () => {
    expect(filtroDoPeriodo(['2026-13', 'x'])).toMatchObject({ meses: [], dataDe: '', dataAte: '' });
  });
});
