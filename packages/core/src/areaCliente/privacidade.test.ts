import { describe, expect, it } from 'vitest';
import { pedidoDeAceite, precisaAceitar, TEXTO_DA_POLITICA } from './privacidade';

describe('o aceite da política de privacidade', () => {
  it('desligada, nunca pede', () => {
    expect(precisaAceitar(null, 'v2', false)).toBe(false);
  });
  it('ligada: pede até aceitar a versão; versão nova pede de novo', () => {
    expect(precisaAceitar(null, 'v2', true)).toBe(true);
    expect(precisaAceitar('v2', 'v2', true)).toBe(false);
    expect(precisaAceitar('v1', 'v2', true)).toBe(true);
  });
  it('o registro só com o token do link', () => {
    expect(pedidoDeAceite('a'.repeat(40), 'v2')).toEqual({ token: 'a'.repeat(40), versao: 'v2' });
    expect(pedidoDeAceite('exemplo', 'v2')).toBeNull();
  });
  it('o texto tem os itens', () => {
    expect(TEXTO_DA_POLITICA.length).toBeGreaterThanOrEqual(5);
  });
});
