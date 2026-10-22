import { describe, expect, it } from 'vitest';
import { aplicacoesDe, podeMexerNoCadastro } from './navegacao';
import type { Operador } from './operador';

const op = (nivel: Operador['nivel'], admin = false): Operador => ({ nome: 'X', departamento: 'contabil', nivel, admin });
const cadastroDe = (o: Operador) => aplicacoesDe(o).find(a => a.id === 'cadastro');

describe('o Cadastro por nível (Vitor, 19/10/2026: o sênior vê e mexe no cadastro das empresas)', () => {
  it('mexem o admin, o diretor e o sênior; o pleno e o júnior não', () => {
    expect(podeMexerNoCadastro(op('senior'))).toBe(true);
    expect(podeMexerNoCadastro(op('diretor'))).toBe(true);
    expect(podeMexerNoCadastro(op(null, true))).toBe(true);
    expect(podeMexerNoCadastro(op('pleno'))).toBe(false);
    expect(podeMexerNoCadastro(op('junior'))).toBe(false);
    expect(podeMexerNoCadastro(null)).toBe(false);
  });

  it('o Cadastro tem só Empresas e Equipe, para o sênior, o diretor e o admin; o pleno não vê o Cadastro', () => {
    // o Painel do robô, o Uso do sistema e o Sistema e agentes foram para o site do admin (22/10/2026)
    for (const o of [op('senior'), op('diretor'), op('senior', true)]) expect(cadastroDe(o)?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios']);
    expect(cadastroDe(op('pleno'))).toBeUndefined();
  });

  it('a navegação não tem mais as telas que viraram do site do admin', () => {
    const ids = aplicacoesDe(op(null, true)).flatMap(a => a.paginas.map(p => a.id + '/' + p.id));
    for (const id of ['cadastro/sistema', 'cadastro/robo', 'cadastro/uso']) expect(ids).not.toContain(id);
  });

  it('o Financeiro continua só com o admin e o diretor', () => {
    expect(aplicacoesDe(op('senior')).some(a => a.id === 'financeiro')).toBe(false);
    expect(aplicacoesDe(op('diretor')).some(a => a.id === 'financeiro')).toBe(true);
  });
});
