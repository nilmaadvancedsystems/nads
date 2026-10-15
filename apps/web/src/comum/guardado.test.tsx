// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { esquecerGuardado, useGuardado } from './guardado';

describe('o onde parou das etapas', () => {
  beforeEach(() => localStorage.clear());

  it('saiu da etapa e voltou: a tela e o arquivo lido estão lá', () => {
    const chave = 'clientes|100|2026-01,2026-02';
    const a = renderHook(() => ({ tela: useGuardado(chave + '|tela', 'arquivos'), dinamico: useGuardado<{ nome: string } | null>(chave + '|dinamico', null) }));
    act(() => { a.result.current.dinamico[1]({ nome: 'dinamico.xls' }); a.result.current.tela[1]('clientes'); });
    expect(a.result.current.tela[0]).toBe('clientes');
    a.unmount();
    // voltou (a tela monta de novo)
    const b = renderHook(() => ({ tela: useGuardado(chave + '|tela', 'arquivos'), dinamico: useGuardado<{ nome: string } | null>(chave + '|dinamico', null) }));
    expect(b.result.current.tela[0]).toBe('clientes');
    expect(b.result.current.dinamico[0]).toEqual({ nome: 'dinamico.xls' });
  });

  it('outra empresa ou outro período: começa do zero; a de antes continua guardada', () => {
    const { result, rerender } = renderHook(({ k }) => useGuardado(k, 0), { initialProps: { k: 'x|1|2026-01' } });
    act(() => result.current[1](a => a + 2));
    expect(result.current[0]).toBe(2);
    rerender({ k: 'x|2|2026-01' });
    expect(result.current[0]).toBe(0);
    rerender({ k: 'x|1|2026-01' });
    expect(result.current[0]).toBe(2);
  });

  it('sem chave não guarda; esquecer tira', () => {
    const a = renderHook(() => useGuardado<string | null>(null, 'a'));
    act(() => a.result.current[1]('b'));
    expect(localStorage.length).toBe(0);
    const b = renderHook(() => useGuardado('creditor|58|2026-01', 1));
    act(() => b.result.current[1](5));
    esquecerGuardado('creditor|58|2026-01');
    b.unmount();
    expect(renderHook(() => useGuardado('creditor|58|2026-01', 1)).result.current[0]).toBe(1);
  });
});
