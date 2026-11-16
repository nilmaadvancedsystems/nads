import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Ouvinte = { chegou: (s: unknown) => void; erro: (e: unknown) => void; parar: ReturnType<typeof vi.fn> };
const ouvintes: Ouvinte[] = [];
vi.mock('firebase/firestore', () => ({
  onSnapshot: (_q: unknown, chegou: Ouvinte['chegou'], erro: Ouvinte['erro']) => {
    const o = { chegou, erro, parar: vi.fn() };
    ouvintes.push(o);
    return o.parar;
  },
}));
const renovarLogin = vi.fn(() => Promise.resolve());
vi.mock('./entregas.firestore', () => ({ renovarLogin: () => renovarLogin() }));

const { ouvirInsistindo } = await import('./ouvirInsistindo.firestore');
const negada = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

describe('o ouvinte não desiste da primeira negada', () => {
  beforeEach(() => { vi.useFakeTimers(); ouvintes.length = 0; renovarLogin.mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('negada logo depois da liberação: renova o login, ouve de novo e a lista chega, sem aviso', async () => {
    const chegou = vi.fn(), falhou = vi.fn();
    ouvirInsistindo({} as never, chegou, falhou);
    ouvintes[0].erro(negada());
    await vi.advanceTimersByTimeAsync(1000);
    expect(renovarLogin).toHaveBeenCalledTimes(1);
    expect(ouvintes).toHaveLength(2);
    ouvintes[1].chegou('lista');
    expect(chegou).toHaveBeenCalledWith('lista');
    expect(falhou).not.toHaveBeenCalled();
  });

  it('negada nas tentativas rápidas: avisa a tela e continua tentando a cada minuto', async () => {
    const chegou = vi.fn(), falhou = vi.fn();
    ouvirInsistindo({} as never, chegou, falhou);
    for (const espera of [1000, 2000, 4000, 8000]) {
      ouvintes[ouvintes.length - 1].erro(negada());
      await vi.advanceTimersByTimeAsync(espera);
    }
    expect(ouvintes).toHaveLength(5);
    expect(falhou).not.toHaveBeenCalled();
    ouvintes[4].erro(negada());
    expect(falhou).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(ouvintes).toHaveLength(6);
    ouvintes[5].chegou('lista');
    expect(chegou).toHaveBeenCalledWith('lista');
  });

  it('o erro que não é negada avisa na hora, sem tentar de novo', async () => {
    const falhou = vi.fn();
    ouvirInsistindo({} as never, vi.fn(), falhou);
    ouvintes[0].erro(Object.assign(new Error('The query requires an index.'), { code: 'failed-precondition' }));
    expect(falhou).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(ouvintes).toHaveLength(1);
  });

  it('parado, não ouve mais', async () => {
    const parar = ouvirInsistindo({} as never, vi.fn(), vi.fn());
    ouvintes[0].erro(negada());
    parar();
    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(ouvintes).toHaveLength(1);
    expect(ouvintes[0].parar).toHaveBeenCalled();
  });
});
