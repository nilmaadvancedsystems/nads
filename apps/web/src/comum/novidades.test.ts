import { describe, expect, it } from 'vitest';
import { NOVIDADES, novidadeLigada } from './novidades';

describe('novidades em teste', () => {
  it('ainda não aprovada: só com o modo desenvolvedor ligado', () => {
    expect(NOVIDADES['inicio-novo'].aprovada).toBe(false);
    expect(novidadeLigada('inicio-novo', false)).toBe(false);
    expect(novidadeLigada('inicio-novo', true)).toBe(true);
  });
});
