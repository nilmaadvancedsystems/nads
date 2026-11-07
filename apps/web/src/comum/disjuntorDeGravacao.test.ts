import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alvosDoDocumento, criarDisjuntor, criarTravaDeGravacao, LIMITES, TODA_A_ABA, type Disparo } from './disjuntorDeGravacao';

const relogio = () => { let t = 1_000_000; return { agora: () => t, andar: (ms: number) => { t += ms; } }; };
const ref = (path: string) => ({ path });

describe('o disjuntor de gravação', () => {
  it('o mesmo documento: até 60 em 1 min passa; a 61ª para por 5 min e depois volta', () => {
    const r = relogio();
    const d = criarDisjuntor(LIMITES, r.agora);
    for (let i = 0; i < 60; i++) { expect(d.passar(['doc:rotinas/x'])).toBeNull(); r.andar(500); }
    const parou = d.passar(['doc:rotinas/x']);
    expect(parou).toMatchObject({ alvo: 'doc:rotinas/x', vezes: 60, novo: true });
    // parado: as seguintes também não passam, sem desarmar de novo
    expect(d.passar(['doc:rotinas/x'])).toMatchObject({ novo: false });
    // outro documento continua gravando
    expect(d.passar(['doc:rotinas/y'])).toBeNull();
    r.andar(5 * 60_000);
    expect(d.passar(['doc:rotinas/x'])).toBeNull();
  });

  it('uma pessoa clicando (um por segundo, no mesmo documento) nunca para em 1 min', () => {
    const r = relogio();
    const d = criarDisjuntor(LIMITES, r.agora);
    for (let i = 0; i < 59; i++) { expect(d.passar(['doc:empresas/a'])).toBeNull(); r.andar(1000); }
  });

  it('a janela desliza: 50 agora e 50 dois minutos depois passam', () => {
    const r = relogio();
    const d = criarDisjuntor(LIMITES, r.agora);
    for (let i = 0; i < 50; i++) expect(d.passar(['doc:a/b'])).toBeNull();
    r.andar(2 * 60_000);
    for (let i = 0; i < 50; i++) expect(d.passar(['doc:a/b'])).toBeNull();
  });

  it('o ciclo lento (um a cada 2 s, sem parar) para pelo teto de 15 min', () => {
    const r = relogio();
    const d = criarDisjuntor(LIMITES, r.agora);
    let parou: Disparo | null = null;
    for (let i = 0; i < 1000 && !parou; i++) { parou = d.passar(['doc:rotinas/x']); r.andar(2000); }
    expect(parou).toMatchObject({ alvo: 'doc:rotinas/x', vezes: 400, janelaMs: 15 * 60_000, novo: true });
  });

  it('documentos novos na mesma coleção (addDoc): mais de 60 em 1 min param a coleção', () => {
    const r = relogio();
    const d = criarDisjuntor(LIMITES, r.agora);
    for (let i = 0; i < 60; i++) expect(d.passar(['col:rotinas/x/eventos'])).toBeNull();
    expect(d.passar(['col:rotinas/x/eventos'])).toMatchObject({ alvo: 'col:rotinas/x/eventos', novo: true });
  });

  it('a aba inteira: mais de 600 gravações em 1 min param tudo por 2 min', () => {
    const r = relogio();
    const d = criarDisjuntor(LIMITES, r.agora);
    for (let i = 0; i < 600; i++) expect(d.passar(['doc:x/' + i])).toBeNull();
    expect(d.passar(['doc:x/novo'])).toMatchObject({ alvo: TODA_A_ABA, novo: true });
    r.andar(2 * 60_000);
    expect(d.passar(['doc:x/novo'])).toBeNull();
  });

  it('o id automático conta também na coleção; o id escolhido, só no documento', () => {
    expect(alvosDoDocumento('rotinas/abc/eventos/AbCdEfGhIjKlMnOpQrSt')).toEqual(['doc:rotinas/abc/eventos/AbCdEfGhIjKlMnOpQrSt', 'col:rotinas/abc/eventos']);
    expect(alvosDoDocumento('rotinas/dornas-havana_2026-10_contabil')).toEqual(['doc:rotinas/dornas-havana_2026-10_contabil']);
    expect(alvosDoDocumento('pedidosSieg/x/xmls/001')).toEqual(['doc:pedidosSieg/x/xmls/001']);
  });
});

describe('a trava no ponto de gravação', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  const montar = () => {
    const r = relogio();
    const avisos: Disparo[] = [];
    const trava = criarTravaDeGravacao({ disjuntor: criarDisjuntor(LIMITES, r.agora), avisar: d => { avisos.push(d); }, atrasoDaRecusaMs: 1000 });
    return { r, avisos, trava };
  };

  it('setDoc em ciclo: grava 60 vezes, depois recusa (com atraso, sem lançar na hora) e avisa uma vez', async () => {
    const { avisos, trava } = montar();
    const gravar = vi.fn(async (_ref: unknown, _d: unknown) => undefined);
    const setDoc = trava.travar(gravar);
    for (let i = 0; i < 60; i++) await setDoc(ref('rotinas/x'), { i });
    expect(gravar).toHaveBeenCalledTimes(60);
    const recusas = Array.from({ length: 100 }, () => setDoc(ref('rotinas/x'), {}).then(() => 'gravou', (e: Error) => e.name + ': ' + e.message));
    await vi.advanceTimersByTimeAsync(1000);
    const r = await Promise.all(recusas);
    expect(gravar).toHaveBeenCalledTimes(60);
    expect(r.every(x => x.startsWith('DisjuntorDeGravacao: Gravação pausada'))).toBe(true);
    expect(r[0]).toContain('rotinas/x');
    expect(avisos).toHaveLength(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('addDoc conta pela coleção', async () => {
    const { trava } = montar();
    const gravar = vi.fn(async (_col: unknown, _d: unknown) => ({ id: 'novo' }));
    const addDoc = trava.travarPedido(gravar);
    for (let i = 0; i < 60; i++) await addDoc(ref('auditoria'), {});
    const p = addDoc(ref('auditoria'), {}).catch((e: Error) => e.name);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBe('DisjuntorDeGravacao');
    expect(gravar).toHaveBeenCalledTimes(60);
  });

  it('o lote do incidente (a tarefa e um evento novo a cada volta) para pela tarefa', async () => {
    const { trava, avisos } = montar();
    let commits = 0;
    const novoLote = () => {
      const lote = {
        set(_ref: unknown, _d: unknown) { return lote; },
        update(_ref: unknown, _d: unknown) { return lote; },
        delete(_ref: unknown) { return lote; },
        commit: async () => { commits++; },
      };
      return trava.travarLote(lote);
    };
    const ids = () => Math.random().toString(36).slice(2, 12).padEnd(10, 'x');
    const resultados: string[] = [];
    for (let i = 0; i < 70; i++) {
      const b = novoLote();
      b.set(ref('rotinas/dornas_2026-10_contabil'), {}).set(ref('rotinas/dornas_2026-10_contabil/eventos/' + (ids() + ids()).slice(0, 20)), {});
      const p = b.commit().then(() => 'ok', () => 'recusado');
      await vi.advanceTimersByTimeAsync(1000);
      resultados.push(await p);
    }
    expect(commits).toBe(60);
    expect(resultados.filter(x => x === 'recusado')).toHaveLength(10);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].alvo).toMatch(/^(doc:rotinas\/dornas_2026-10_contabil|col:rotinas\/dornas_2026-10_contabil\/eventos)$/);
  });

  it('um erro do disjuntor nunca impede a gravação', async () => {
    const trava = criarTravaDeGravacao({ disjuntor: { passar: () => { throw new Error('quebrou'); } }, avisar: () => undefined, atrasoDaRecusaMs: 0 });
    const gravar = vi.fn(async (_ref: unknown) => 'ok');
    expect(await trava.travar(gravar)(ref('a/b'))).toBe('ok');
  });

  it('o aviso que falha não derruba a gravação nem a recusa', async () => {
    const r = relogio();
    const trava = criarTravaDeGravacao({ disjuntor: criarDisjuntor(LIMITES, r.agora), avisar: () => { throw new Error('sem banco'); }, atrasoDaRecusaMs: 0 });
    const setDoc = trava.travar(async (_ref: unknown) => 'ok');
    for (let i = 0; i < 60; i++) await setDoc(ref('a/b'));
    const p = setDoc(ref('a/b')).catch((e: Error) => e.name);
    await vi.advanceTimersByTimeAsync(0);
    expect(await p).toBe('DisjuntorDeGravacao');
  });
});
