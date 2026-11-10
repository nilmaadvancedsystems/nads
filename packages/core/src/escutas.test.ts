import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarRepoCadastro, type PortaCadastro } from './empresas/cadastro/repo';
import { criarEscutas, SEM_USO_MS } from './escutas';

describe('as escutas sem uso se encerram sozinhas', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sem ninguém lendo: as telas são avisadas e a escuta encerra', () => {
    const avisar = vi.fn();
    const encerrar = vi.fn();
    criarEscutas(avisar).guardar('a', encerrar);
    vi.advanceTimersByTime(SEM_USO_MS);
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(encerrar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(encerrar).toHaveBeenCalledTimes(1);
  });

  it('a tela aberta e parada lê ao ser avisada e a escuta fica', () => {
    const encerrar = vi.fn();
    const e = criarEscutas(() => e.usar('a'));
    e.guardar('a', encerrar);
    vi.advanceTimersByTime(3 * SEM_USO_MS);
    expect(encerrar).not.toHaveBeenCalled();
  });

  it('com leitura recente, nem avisa', () => {
    const avisar = vi.fn();
    const e = criarEscutas(avisar);
    e.guardar('a', vi.fn());
    for (let i = 0; i < 40; i++) { vi.advanceTimersByTime(60_000); e.usar('a'); }
    expect(avisar).not.toHaveBeenCalled();
  });

  it('encerra só a que ninguém leu', () => {
    const paradaA = vi.fn();
    const paradaB = vi.fn();
    const e = criarEscutas(() => e.usar('b'));
    e.guardar('a', paradaA);
    e.guardar('b', paradaB);
    vi.advanceTimersByTime(SEM_USO_MS + 65_000);
    expect(paradaA).toHaveBeenCalledTimes(1);
    expect(paradaB).not.toHaveBeenCalled();
  });

  describe('no repositório do cadastro', () => {
    function montar() {
      const parar = vi.fn();
      const ouvirCadastro = vi.fn((_id: string, chegou: (d: null) => void) => { chegou(null); return parar; });
      const porta = { ouvirCadastro, ouvirPlano: (_id: string, chegou: (d: null) => void) => { chegou(null); return parar; }, ouvirTodos: () => parar, gravarCampos: async () => {} } as unknown as PortaCadastro;
      return { repo: criarRepoCadastro(porta, false), parar, ouvirCadastro };
    }

    it('empresa que ninguém mais olha: para as duas escutas e abre de novo na próxima leitura', () => {
      const { repo, parar, ouvirCadastro } = montar();
      repo.cadastro('EMPRESA', 1);
      vi.advanceTimersByTime(SEM_USO_MS + 5_000);
      expect(parar).toHaveBeenCalledTimes(2);
      repo.cadastro('EMPRESA', 1);
      expect(ouvirCadastro).toHaveBeenCalledTimes(2);
    });

    it('tela aberta e parada: ao ser avisada lê de novo e as escutas ficam', () => {
      const { repo, parar, ouvirCadastro } = montar();
      repo.cadastro('EMPRESA', 1);
      repo.assinar(() => { repo.cadastro('EMPRESA', 1); });
      vi.advanceTimersByTime(3 * SEM_USO_MS);
      expect(parar).not.toHaveBeenCalled();
      expect(ouvirCadastro).toHaveBeenCalledTimes(1);
    });
  });

  it('encerrada, a mesma chave pode abrir de novo', () => {
    const primeira = vi.fn();
    const segunda = vi.fn();
    const e = criarEscutas(() => {});
    e.guardar('a', primeira);
    vi.advanceTimersByTime(SEM_USO_MS + 65_000);
    e.guardar('a', segunda);
    vi.advanceTimersByTime(60_000);
    expect(primeira).toHaveBeenCalledTimes(1);
    expect(segunda).not.toHaveBeenCalled();
  });
});
