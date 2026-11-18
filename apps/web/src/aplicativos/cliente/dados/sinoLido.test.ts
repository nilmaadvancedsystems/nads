// O "lido" do sino que não volta a cada visita (plano do Acessórias, 17/11/2026, ficha aviso-de-resposta, parte A).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guardarLidas, lidasDoSino, MAXIMO_DE_EMPRESAS, MAXIMO_DE_LIDAS, soAsQueAindaExistem } from './sinoLido';

function armazenamentoDeMentira() {
  const dados = new Map<string, string>();
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => { dados.set(k, v); },
    removeItem: (k: string) => { dados.delete(k); },
    clear: () => dados.clear(),
  };
}

beforeEach(() => { vi.stubGlobal('localStorage', armazenamentoDeMentira()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('o lido do sino', () => {
  it('guarda e lê por empresa', () => {
    guardarLidas('a', ['c-1-2', 'g-9']);
    guardarLidas('b', ['docs-3']);
    expect(lidasDoSino('a')).toEqual(new Set(['c-1-2', 'g-9']));
    expect(lidasDoSino('b')).toEqual(new Set(['docs-3']));
    expect(lidasDoSino('c')).toEqual(new Set());
  });
  it('no máximo 200 avisos por empresa (ficam os últimos)', () => {
    const ids = Array.from({ length: 250 }, (_, i) => 'x-' + i);
    guardarLidas('a', ids);
    const lidas = lidasDoSino('a');
    expect(lidas.size).toBe(MAXIMO_DE_LIDAS);
    expect(lidas.has('x-249')).toBe(true);
    expect(lidas.has('x-0')).toBe(false);
  });
  it('no máximo 30 empresas (a mais antiga sai)', () => {
    for (let i = 0; i < 35; i++) guardarLidas('t' + i, ['x']);
    expect(lidasDoSino('t34').size).toBe(1);
    expect(lidasDoSino('t0').size).toBe(0);
    expect(lidasDoSino('t' + (35 - MAXIMO_DE_EMPRESAS)).size).toBe(1);
  });
  it('localStorage que joga erro: lê vazio e não quebra', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
    });
    expect(() => guardarLidas('a', ['x'])).not.toThrow();
    expect(lidasDoSino('a')).toEqual(new Set());
  });
  it('guardado torto não quebra', () => {
    localStorage.setItem('nads-area-cliente|sino', '{"nao":"lista"}');
    expect(lidasDoSino('a')).toEqual(new Set());
    localStorage.setItem('nads-area-cliente|sino', '[["a",["ok",3]],"lixo"]');
    expect(lidasDoSino('a')).toEqual(new Set(['ok']));
  });
  it('só as que ainda existem no sino', () => {
    expect(soAsQueAindaExistem(new Set(['c-1-2', 'velho']), [{ id: 'c-1-2' }, { id: 'g-3' }])).toEqual(['c-1-2']);
  });
});
