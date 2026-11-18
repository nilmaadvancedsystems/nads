import { describe, expect, it } from 'vitest';
import { PASSOS_DO_TUTORIAL, passosNaTela } from './passosDoTutorial';

describe('o tutorial do Lançatudo (18/11/2026)', () => {
  it('começa e termina no cartão do meio (sem parte)', () => {
    const p = PASSOS_DO_TUTORIAL;
    expect([p[0].alvo, p[p.length - 1].alvo]).toEqual([undefined, undefined]);
    expect(new Set(p.map(x => x.id)).size).toBe(p.length);
  });
  it('o passo cuja parte não está na tela fica de fora (o Confirmar num mês sem sugestão do razão)', () => {
    const ids = passosNaTela(alvo => !alvo.includes('lt-selo-confirmar')).map(p => p.id);
    expect(ids).not.toContain('confirmar');
    expect(ids[0]).toBe('oi');
    expect(ids[ids.length - 1]).toBe('pronto');
    expect(passosNaTela(() => false).map(p => p.id)).toEqual(['oi', 'pronto']);
  });
});
