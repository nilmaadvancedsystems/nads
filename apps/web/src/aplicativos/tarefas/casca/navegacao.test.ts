import { describe, expect, it } from 'vitest';
import { aplicacoesDe, podeMexerNoCadastro, podeVerOFinanceiro } from './navegacao';
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

  it('as Configurações: Empresas e Equipe para o sênior, o diretor e o admin; as páginas do Admin só para o admin (28/10/2026)', () => {
    for (const o of [op('senior'), op('diretor')]) expect(cadastroDe(o)?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios']);
    const doAdmin = cadastroDe(op('senior', true));
    expect(doAdmin?.nome).toBe('Configurações');
    expect(doAdmin?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios', 'visao-geral', 'robo', 'arquivador', 'uso', 'banco', 'cota', 'feedbacks', 'sistema']);
    expect(cadastroDe(op('pleno'))).toBeUndefined();
  });

  it('o Financeiro só com o Sávio e a Nilma, pelo nome; o admin e o diretor não entram pelo papel (30/10/2026)', () => {
    const vê = (o: Operador) => aplicacoesDe(o).some(a => a.id === 'financeiro');
    expect(vê({ ...op('diretor', true), nome: 'Sávio' })).toBe(true);
    expect(vê({ ...op('diretor', true), nome: 'Savio' })).toBe(true);
    expect(vê({ ...op('diretor'), nome: 'Nilma' })).toBe(true);
    expect(vê({ ...op('pleno'), nome: 'NILMA' })).toBe(true);
    expect(vê(op('diretor', true))).toBe(false);
    expect(vê(op('diretor'))).toBe(false);
    expect(vê({ ...op('senior', true), nome: 'Vitor' })).toBe(false);
    expect(podeVerOFinanceiro(null)).toBe(false);
  });
});
