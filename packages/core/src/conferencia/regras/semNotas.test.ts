import { describe, expect, it } from 'vitest';
import { marcarSemNotas } from '../acoes';
import { empresaNova, resolvidoNoPeriodo, semNotasDoPeriodo } from './empresa';
import { requisitosDasNotas } from '../../extratudo/extrator/regras/requisitos';

describe('sem movimento no período (Clara, 29/10/2026: a empresa sem saídas)', () => {
  const meses = ['2026-01', '2026-02', '2026-09'];
  it('marcado no período, as Saídas contam como resolvidas e a etapa segue', () => {
    const e = marcarSemNotas(empresaNova('X'), 'saidas', meses, true);
    const r = resolvidoNoPeriodo(e, meses);
    expect(r.saidas).toBe(true);
    expect(r.entradas).toBe(false);
    expect(requisitosDasNotas({ ...r, entradas: true, tomados: true }, false).pronto).toBe(true);
  });
  it('a marca de outro período não vale; sem os meses, só o importado', () => {
    const e = marcarSemNotas(empresaNova('X'), 'saidas', meses, true);
    expect(semNotasDoPeriodo(e, ['2026-10']).saidas).toBe(false);
    expect(resolvidoNoPeriodo(e).saidas).toBe(false);
    expect(semNotasDoPeriodo(e, ['2026-09', '2026-01']).saidas).toBe(true);
  });
  it('desmarcar tira o campo', () => {
    const e = marcarSemNotas(marcarSemNotas(empresaNova('X'), 'saidas', meses, true), 'saidas', meses, false);
    expect(e.semNotasNoPeriodo).toBeUndefined();
  });
});
