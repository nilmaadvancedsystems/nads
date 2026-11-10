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

  it('cancelar e passar na frente mexem só naquele pedido', async () => {
    const repo = criarCentralMemoria();
    expect(repo.fila('fgts').itens.map(i => i.id)).toEqual(['ex-f1', 'ex-f2', 'ex-f3', 'ex-f4']);
    await repo.pedir({ robo: 'fgts', acao: 'na-frente', item: 'ex-f4' });
    vi.advanceTimersByTime(2600);
    expect(repo.fila('fgts').itens.map(i => i.id)).toEqual(['ex-f1', 'ex-f4', 'ex-f2', 'ex-f3']);
    await repo.pedir({ robo: 'fgts', acao: 'cancelar-item', item: 'ex-f2' });
    vi.advanceTimersByTime(2600);
    expect(repo.fila('fgts').itens.map(i => i.id)).toEqual(['ex-f1', 'ex-f4', 'ex-f3']);
    await repo.pedir({ robo: 'fgts', acao: 'cancelar-item', item: 'ex-f1' });
    vi.advanceTimersByTime(2600);
    expect(repo.docs().comandos[0]).toMatchObject({ status: 'recusado' });
    expect(repo.docs().comandos[0].mensagem).toMatch(/em andamento/);
    expect(repo.fila('fgts').itens.map(i => i.id)).toContain('ex-f1');
  });

  it('parar tudo pausa os pausáveis da máquina com a hora de voltar; retomar tudo solta', async () => {
    const repo = criarCentralMemoria();
    const ate = new Date(Date.now() + 3600000).toISOString();
    await repo.pedir({ robo: '', maquina: 'servidor', acao: 'parar-tudo', ate });
    vi.advanceTimersByTime(2600);
    expect(Object.keys(repo.docs().maquinas.servidor?.pausados || {}).sort()).toEqual(['alterdata', 'fgts', 'sieg']);
    expect(repo.docs().maquinas.servidor?.pausados.fgts.ate).toBe(ate);
    await repo.pedir({ robo: '', maquina: 'servidor', acao: 'retomar-tudo' });
    vi.advanceTimersByTime(2600);
    expect(repo.docs().maquinas.servidor?.pausados).toEqual({});
  });

  it('pedir para um cliente entra na fila do robô', async () => {
    const repo = criarCentralMemoria();
    await repo.pedir({ robo: 'fgts', acao: 'pedir-cliente', tarefa: 'guia', cliente: '486', competencia: '2026-10' });
    vi.advanceTimersByTime(2600);
    expect(repo.fila('fgts').itens.at(-1)).toMatchObject({ titulo: '486 VS MEDICINA ESPECIALIZADA LTDA (10/2026)', detalhe: 'Emitir a guia' });
  });

  it('o erro com pedido pode ser refeito; o de lote, não', () => {
    const d = docsDeExemplo();
    const a9 = d.atividades.find(a => a.id === 'a9')!;
    const a12 = d.atividades.find(a => a.id === 'a12')!;
    expect(r.estadoDoRefazer(a9, [])).toBe('pode');
    expect(r.estadoDoRefazer(a12, [])).toBe('nao');
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
