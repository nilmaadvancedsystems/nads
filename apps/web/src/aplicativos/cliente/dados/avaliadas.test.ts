// As notas lembradas no aparelho (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento).
import { beforeEach, describe, expect, it } from 'vitest';
import { guardarNota, notasDadas } from './avaliadas';

const memoria = new Map<string, string>();
beforeEach(() => {
  memoria.clear();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => memoria.get(k) ?? null, setItem: (k: string, v: string) => { memoria.set(k, v); } } });
});

describe('as notas lembradas no aparelho', () => {
  it('guarda por empresa e a última vale', () => {
    guardarNota('tokA', 'c1', 3);
    guardarNota('tokA', 'c1', 5);
    guardarNota('tokB', 'c9', 2);
    expect(notasDadas('tokA')).toEqual({ c1: 5 });
    expect(notasDadas('tokB')).toEqual({ c9: 2 });
    expect(notasDadas('outro')).toEqual({});
  });
  it('o guardado torto vira nada', () => {
    memoria.set('nads-area-cliente|avaliadas', '{"x":1}');
    expect(notasDadas('tokA')).toEqual({});
  });
});
