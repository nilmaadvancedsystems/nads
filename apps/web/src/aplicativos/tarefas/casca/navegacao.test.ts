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

  it('o sênior vê Empresas e Equipe (os responsáveis), sem o Sistema e agentes e sem o Painel do robô', () => {
    expect(cadastroDe(op('senior'))?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios']);
  });

  it('o diretor e o admin continuam com as páginas todas; o pleno não vê o Cadastro', () => {
    expect(cadastroDe(op('diretor'))?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios', 'sistema', 'robo']);
    expect(cadastroDe(op('senior', true))?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios', 'sistema', 'robo']);
    expect(cadastroDe(op('pleno'))).toBeUndefined();
  });

  it('o Financeiro continua só com o admin e o diretor', () => {
    expect(aplicacoesDe(op('senior')).some(a => a.id === 'financeiro')).toBe(false);
    expect(aplicacoesDe(op('diretor')).some(a => a.id === 'financeiro')).toBe(true);
  });
});
