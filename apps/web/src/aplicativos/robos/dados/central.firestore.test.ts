// A Central dos robôs no banco, com um Firestore de mentira (vi.mock): no modo desenvolvedor (13/11/2026, a Central aberta
// dentro da Tarefas), nenhum comando chega ao robosComandos; só o 'assistir', que não muda nada (liga o espelho do log).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ gravados: [] as { caminho: string; dados: Record<string, unknown> }[] }));

vi.mock('firebase/firestore', () => {
  const ref = (base: { path: string }, ...seg: string[]) => ({ path: [base.path, ...seg].filter(Boolean).join('/') });
  return {
    doc: ref, collection: ref, query: (r: unknown) => r, where: () => null, orderBy: () => null, limit: () => null,
    onSnapshot: () => () => undefined,
    getDocs: async () => ({ docs: [] }),
    addDoc: async (r: { path: string }, dados: Record<string, unknown>) => {
      falso.gravados.push({ caminho: r.path, dados });
      return { id: 'cmd' + falso.gravados.length };
    },
  };
});
vi.mock('../../tarefas/dados/entregas.firestore', () => ({
  bancoDoEntregas: () => ({ path: '' }),
  contaDoEntregas: () => ({ uid: 'uid-vitor', email: 'vitor@exemplo.com' }),
}));

const { criarCentralFirestore } = await import('./central.firestore');

function comModoDev(ligado: boolean) {
  vi.stubGlobal('localStorage', { getItem: (k: string) => (ligado && k === 'nads-modo-desenvolvedor' ? '1' : null) });
  vi.stubGlobal('window', { dispatchEvent: () => true });
}

beforeEach(() => { falso.gravados.length = 0; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('os comandos da Central', () => {
  it('desligado: o comando vai para o robosComandos', async () => {
    comModoDev(false);
    await expect(criarCentralFirestore().pedir({ robo: 'sieg', acao: 'reiniciar', porNome: 'Vitor' })).resolves.toBe('cmd1');
    expect(falso.gravados.map(g => [g.caminho, g.dados.acao])).toEqual([['robosComandos', 'reiniciar']]);
  });

  it('no modo desenvolvedor: o comando é recusado e nada é gravado', async () => {
    comModoDev(true);
    const central = criarCentralFirestore();
    await expect(central.pedir({ robo: 'sieg', acao: 'reiniciar', porNome: 'Vitor' })).rejects.toThrow('Modo desenvolvedor: nada foi enviado.');
    await expect(central.pedir({ robo: 'vigia', acao: 'rodar-agora', tarefa: 'ler-gmail', porNome: 'Vitor' })).rejects.toThrow('Modo desenvolvedor');
    expect(falso.gravados).toEqual([]);
  });

  it('no modo desenvolvedor, o assistir (só ver o log ao vivo) continua saindo', async () => {
    comModoDev(true);
    await criarCentralFirestore().pedir({ robo: 'sieg', acao: 'assistir', porNome: 'Vitor' });
    expect(falso.gravados.map(g => g.dados.acao)).toEqual(['assistir']);
  });
});
