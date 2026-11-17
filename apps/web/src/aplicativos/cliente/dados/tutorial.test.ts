import { describe, expect, it } from 'vitest';
import { capitulosDoTutorial, passosDaTela, passosDoTutorial, todosOsPassos } from './tutorial';

const TODAS = ['inicio', 'documentos', 'guias', 'dp', 'chamados', 'faturamento', 'empresa', 'contato'];

describe('o tutorial guiado (13/11/2026)', () => {
  // 15/11/2026: "procura exemplos de tutorias em sites famosos, e use como base"
  it('o tour de boas-vindas é curto: 4 passos com parte, entre o cartão do começo e o do fim', () => {
    for (const modo of ['pc', 'celular'] as const) {
      const p = passosDoTutorial(modo, TODAS);
      expect([p[0].id, p[p.length - 1].id]).toEqual(['oi', 'pronto']);
      expect([p[0].alvo, p[p.length - 1].alvo]).toEqual([undefined, undefined]);
      expect(p.filter(x => x.alvo)).toHaveLength(4);
    }
    expect(passosDoTutorial('pc', TODAS).map(p => p.id)).toEqual(['oi', 'menu', 'precisa', 'a-pagar', 'sol-nova', 'pronto']);
    expect(passosDoTutorial('celular', TODAS).map(p => p.id)).toEqual(['oi', 'abas', 'precisa', 'a-pagar', 'sol-nova', 'pronto']);
  });
  it('sem as Guias, o passo delas sai do tour', () => {
    expect(passosDoTutorial('pc', ['inicio', 'chamados']).map(p => p.id)).toEqual(['oi', 'menu', 'precisa', 'sol-nova', 'pronto']);
  });
  it('cada passo tem título e texto', () => {
    for (const p of todosOsPassos('pc', TODAS)) expect(p.titulo && p.texto).toBeTruthy();
  });
  it('os capítulos do tour, na ordem, sem o começo e o fim', () => {
    expect(capitulosDoTutorial(passosDoTutorial('pc', TODAS))).toEqual(['Menu', 'Guias e documentos', 'Guias', 'Solicitações']);
  });
  it('o "?" de cada tela: só os passos dela, sem os cartões e o menu', () => {
    expect(passosDaTela('pc', TODAS, 'dp').map(p => p.id)).toEqual(['equipe', 'ferias', 'custo', 'folha']);
    expect(passosDaTela('celular', TODAS, 'inicio').map(p => p.id)).toEqual(['precisa', 'proximos', 'enviar', 'busca', 'sino']);
    expect(passosDaTela('pc', TODAS, 'empresa').map(p => p.id)).toEqual(['cadastro', 'empresa']);
    for (const aba of TODAS) expect(passosDaTela('pc', TODAS, aba).length).toBeGreaterThan(0);
    expect(passosDaTela('pc', ['inicio'], 'dp')).toEqual([]);
  });
  it('as abas de dentro do Registro se abrem sozinhas no passo', () => {
    expect(passosDaTela('pc', TODAS, 'dp').every(p => p.clicar?.includes('data-aba'))).toBe(true);
  });
  it('o balão curto: o texto em até 140 letras e até 3 tópicos', () => {
    for (const p of todosOsPassos('pc', TODAS)) {
      if (p.marcas?.length) expect(p.texto.length).toBeLessThanOrEqual(140);
      expect(p.marcas?.length ?? 0).toBeLessThanOrEqual(3);
    }
  });
});
