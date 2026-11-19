// A página própria de criar a senha (19/11/2026).
import { describe, expect, it } from 'vitest';
import { erroDaSenhaNova } from './useCriarSenha';

describe('a senha nova', () => {
  it('pelo menos 8, com letras e números, e as duas iguais', () => {
    expect(erroDaSenhaNova('abc123', 'abc123')).toMatch(/8/);
    expect(erroDaSenhaNova('abcdefgh', 'abcdefgh')).toMatch(/letras e números/);
    expect(erroDaSenhaNova('12345678', '12345678')).toMatch(/letras e números/);
    expect(erroDaSenhaNova('padaria2026', 'padaria2025')).toMatch(/iguais/);
    expect(erroDaSenhaNova('padaria2026', 'padaria2026')).toBe('');
  });
});
