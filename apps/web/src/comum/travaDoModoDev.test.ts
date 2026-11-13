// A trava leve do modo desenvolvedor (a da Área do Cliente): desligada, o pedido sai; ligada, não chega a chamar o banco.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHAVE_DO_MODO_DEV, EVENTO_BLOQUEADO, MENSAGEM_BLOQUEADO, modoDevLigado, recusarNoModoDev } from './travaDoModoDev';

function comModoDev(ligado: boolean) {
  const guardado = new Map<string, string>(ligado ? [[CHAVE_DO_MODO_DEV, '1']] : []);
  vi.stubGlobal('localStorage', { getItem: (k: string) => guardado.get(k) ?? null });
  const eventos: string[] = [];
  vi.stubGlobal('window', { dispatchEvent: (e: Event) => { eventos.push(e.type); return true; } });
  return eventos;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('a trava leve do modo desenvolvedor', () => {
  it('desligado: o pedido sai como sempre', async () => {
    comModoDev(false);
    const gravar = vi.fn(async (x: number) => x * 2);
    expect(modoDevLigado()).toBe(false);
    await expect(recusarNoModoDev(gravar)(21)).resolves.toBe(42);
    expect(gravar).toHaveBeenCalledOnce();
  });

  it('ligado: recusa com a mensagem do modo, avisa a tela e não chama o banco', async () => {
    const eventos = comModoDev(true);
    const gravar = vi.fn(async () => 'gravou');
    expect(modoDevLigado()).toBe(true);
    await expect(recusarNoModoDev(gravar)()).rejects.toThrow(MENSAGEM_BLOQUEADO);
    expect(gravar).not.toHaveBeenCalled();
    expect(eventos).toEqual([EVENTO_BLOQUEADO]);
  });

  it('sem armazenamento (navegador que bloqueia): fica desligado', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado'); } });
    expect(modoDevLigado()).toBe(false);
  });
});
