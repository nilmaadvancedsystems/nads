import { describe, expect, it } from 'vitest';
import { criarCacheDaAtualizacao } from './cacheDaAtualizacao';

function lojaDeMentira() {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

describe('cache da atualização de versão', () => {
  it('devolve o que guardou, dentro da validade e para a mesma conta', () => {
    const loja = lojaDeMentira();
    let t = 1000;
    const c = criarCacheDaAtualizacao<number[]>('k', 500, () => loja, () => t);
    expect(c.ler('ana')).toBeNull();
    c.guardar('ana', [1, 2]);
    t = 1499;
    expect(c.ler('ana')).toEqual([1, 2]);
    expect(c.ler('bia')).toBeNull();
    t = 1500;
    expect(c.ler('ana')).toBeNull();
  });
  it('sem espaço, não guarda nem deixa o velho, e nunca lança erro', () => {
    const loja = lojaDeMentira();
    loja.m.set('k', 'velho');
    const c = criarCacheDaAtualizacao<number>('k', 500, () => ({ ...loja, setItem: () => { throw new Error('cheio'); } }));
    expect(() => c.guardar('ana', 1)).not.toThrow();
    expect(loja.m.has('k')).toBe(false);
  });
  it('sem sessionStorage ou com lixo guardado: só não acha', () => {
    const quebrada = criarCacheDaAtualizacao<number>('k', 500, () => { throw new Error('bloqueado'); });
    expect(quebrada.ler('ana')).toBeNull();
    expect(() => quebrada.guardar('ana', 1)).not.toThrow();
    const loja = lojaDeMentira();
    loja.m.set('k', '{quebrado');
    expect(criarCacheDaAtualizacao<number>('k', 500, () => loja).ler('ana')).toBeNull();
  });
});
