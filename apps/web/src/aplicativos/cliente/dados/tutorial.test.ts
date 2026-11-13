import { describe, expect, it } from 'vitest';
import { capitulosDoTutorial, passosDoTutorial } from './tutorial';

const TODAS = ['inicio', 'documentos', 'guias', 'dp', 'chamados', 'faturamento', 'empresa', 'contato'];

describe('o tutorial guiado (13/11/2026)', () => {
  it('no PC, o menu lateral; no celular, as abas de baixo e o Mais', () => {
    const pc = passosDoTutorial('pc', TODAS).map(p => p.id);
    const cel = passosDoTutorial('celular', TODAS).map(p => p.id);
    expect(pc).toContain('menu');
    expect(pc).not.toContain('abas');
    expect(cel).toEqual(expect.arrayContaining(['abas', 'mais']));
    expect(cel).not.toContain('menu');
  });
  it('começa no "oi" e termina no "pronto", os dois sem alvo', () => {
    for (const modo of ['pc', 'celular'] as const) {
      const p = passosDoTutorial(modo, TODAS);
      expect([p[0].id, p[p.length - 1].id]).toEqual(['oi', 'pronto']);
      expect([p[0].alvo, p[p.length - 1].alvo]).toEqual([undefined, undefined]);
    }
  });
  it('sem a Central e sem o Registro, os passos deles saem', () => {
    const ids = passosDoTutorial('pc', ['inicio', 'guias', 'chamados']).map(p => p.id);
    expect(ids).not.toEqual(expect.arrayContaining(['pastas']));
    expect(ids.some(i => i === 'pastas' || i === 'lista' || i === 'equipe' || i === 'folha')).toBe(false);
    expect(ids).toContain('a-pagar');
  });
  it('cada passo tem título e texto', () => {
    for (const p of passosDoTutorial('pc', TODAS)) expect(p.titulo && p.texto).toBeTruthy();
  });
  it('os capítulos na ordem, sem o começo e o fim', () => {
    expect(capitulosDoTutorial(passosDoTutorial('pc', TODAS))).toEqual(['Menu', 'Visão geral', 'Guias', 'Documentos', 'Solicitações', 'Registro', 'Atalhos']);
    expect(capitulosDoTutorial(passosDoTutorial('pc', ['inicio', 'guias', 'chamados']))).toEqual(['Menu', 'Visão geral', 'Guias', 'Solicitações', 'Atalhos']);
  });
});
