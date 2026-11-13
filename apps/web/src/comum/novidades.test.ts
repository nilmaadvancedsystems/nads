import { describe, expect, it } from 'vitest';
import { NOVIDADES, novidadeLigada } from './novidades';

describe('novidades em teste', () => {
  it('ainda não aprovada: só com o modo desenvolvedor ligado', () => {
    expect(NOVIDADES.administrativo.aprovada).toBe(false);
    expect(novidadeLigada('administrativo', false)).toBe(false);
    expect(novidadeLigada('administrativo', true)).toBe(true);
  });

  it('aprovada: vale para todos, com ou sem o modo desenvolvedor (o Início novo, 13/11/2026)', () => {
    expect(NOVIDADES['inicio-novo'].aprovada).toBe(true);
    expect(novidadeLigada('inicio-novo', false)).toBe(true);
    expect(novidadeLigada('inicio-novo', true)).toBe(true);
  });
});
