// @vitest-environment jsdom
// A trava: sem porta (exemplos) fica aberta; com porta, pede o login e só passa quem tem o papel.
import { usuarios } from '@nads/core';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useTrava, type EstadoDaPorta, type PortaDaTrava } from './useTrava';

function portaDeTeste(inicial: EstadoDaPorta) {
  let estado = inicial;
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const porta: PortaDaTrava = {
    estado: () => estado,
    async entrar() { /* o teste muda o estado com `mudar` */ },
    async sair() { mudar({ pronta: true, usuario: null, aviso: '' }); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
  function mudar(e: EstadoDaPorta) { estado = e; ver++; for (const f of ouvintes) f(); }
  return { porta, mudar };
}

const por = (nome: string) => usuarios.EQUIPE_EXEMPLO.find(u => u.nome === nome)!;

describe('trava de acesso', () => {
  it('sem porta (exemplos) fica aberta', () => {
    const { result } = renderHook(() => useTrava(null, ['conferencia']));
    expect(result.current.fase).toBe('aberta');
  });

  it('espera a sessão, pede o login e abre para o contábil', () => {
    const { porta, mudar } = portaDeTeste({ pronta: false, usuario: null, aviso: '' });
    const { result } = renderHook(() => useTrava(porta, ['conferencia']));
    expect(result.current.fase).toBe('carregando');
    act(() => mudar({ pronta: true, usuario: null, aviso: '' }));
    expect(result.current.fase).toBe('entrar');
    act(() => mudar({ pronta: true, usuario: por('Clara'), aviso: '' }));
    expect(result.current.fase).toBe('aberta');
  });

  it('quem não tem o papel vê o sem acesso, com o que libera', () => {
    const { porta } = portaDeTeste({ pronta: true, usuario: por('Heverton'), aviso: '' });
    const { result } = renderHook(() => useTrava(porta, ['extrator', 'cheque-especial', 'creditor']));
    expect(result.current.fase).toBe('sem-acesso');
    expect(result.current.semAcesso).toEqual({ nome: 'Heverton', cargo: 'Fiscal · Pleno' });
    expect(result.current.papeisQueLiberam).toBe('Contábil ou Admin');
  });

  it('o admin passa em qualquer aplicativo', () => {
    const { porta } = portaDeTeste({ pronta: true, usuario: por('Sávio'), aviso: '' });
    const { result } = renderHook(() => useTrava(porta, ['conciliadorzinho']));
    expect(result.current.fase).toBe('aberta');
  });
});
