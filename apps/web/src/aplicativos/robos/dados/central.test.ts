import { robos as r } from '@nads/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarCentralMemoria, docsDeExemplo } from './central';

describe('a Central dos robôs nos exemplos', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('os exemplos têm as 3 máquinas vivas e cada robô com situação', () => {
    const agora = Date.now();
    const d = docsDeExemplo(agora);
    const maquinas = r.MAQUINAS.map(m => r.situacaoDaMaquina(m, m.id === 'servidor' ? d.batimentos.servidor : m.id === 'nuvem' ? d.batimentos.nuvem : null, d.maquinas[m.id], agora));
    expect(maquinas.map(m => m.tom)).toEqual(['ok', 'ok', 'ok']);
    expect(maquinas.every(m => m.sinais && m.sinais.cpu != null)).toBe(true);
  });

  it('o robô de mentira aceita, faz e a pausa aparece na máquina', async () => {
    const repo = criarCentralMemoria();
    const id = await repo.pedir({ robo: 'ia', acao: 'retomar', porNome: 'Vitor' });
    expect(repo.docs().comandos[0]).toMatchObject({ id, status: 'pendente', porNome: 'Vitor' });
    vi.advanceTimersByTime(1100);
    expect(repo.docs().comandos[0].status).toBe('aceito');
    vi.advanceTimersByTime(2000);
    expect(repo.docs().comandos[0].status).toBe('feito');
    expect(repo.docs().maquinas.escritorio?.pausados.ia).toBeUndefined();
  });

  it('pedido fora do catálogo não grava nada', async () => {
    const repo = criarCentralMemoria();
    const antes = repo.docs().comandos.length;
    await expect(repo.pedir({ robo: 'sieg', acao: 'shell' })).rejects.toThrow();
    expect(repo.docs().comandos.length).toBe(antes);
  });

  it('os registros ao vivo crescem até 200 linhas', () => {
    const repo = criarCentralMemoria();
    const parar = repo.acompanharRegistros('sieg');
    expect(repo.registros('sieg').linhas.length).toBe(60);
    vi.advanceTimersByTime(4000 * 200);
    expect(repo.registros('sieg').linhas.length).toBe(r.LINHAS_DO_REGISTRO);
    parar();
  });
});
