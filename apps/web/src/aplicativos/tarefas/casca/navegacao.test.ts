import { afterEach, describe, expect, it, vi } from 'vitest';
import { aplicacoesDe, ehDiretor, podeMexerNoCadastro, podeTrocarRazaoSocial, podeVerOFinanceiro } from './navegacao';
import type { Operador } from './operador';

const op = (nivel: Operador['nivel'], admin = false): Operador => ({ nome: 'X', departamento: 'contabil', nivel, admin, desenvolvedor: false });
const cadastroDe = (o: Operador) => aplicacoesDe(o).find(a => a.id === 'cadastro');

describe('a razão social (13/11/2026: "só diretor")', () => {
  it('troca só o nível Diretor e o Dono; o admin sem esse nível, o sênior, o pleno e o júnior não', () => {
    expect(podeTrocarRazaoSocial(op('diretor'))).toBe(true);
    expect(podeTrocarRazaoSocial(op('dono'))).toBe(true);
    expect(podeTrocarRazaoSocial(op('senior', true))).toBe(false);
    expect(podeTrocarRazaoSocial(op(null, true))).toBe(false);
    for (const n of ['senior', 'pleno', 'junior'] as const) expect(podeTrocarRazaoSocial(op(n))).toBe(false);
    expect(podeTrocarRazaoSocial(null)).toBe(false);
  });
});

describe('o Cadastro por nível (Vitor, 19/10/2026: o sênior vê e mexe no cadastro das empresas)', () => {
  it('mexem o admin, o diretor e o sênior; o pleno e o júnior não', () => {
    expect(podeMexerNoCadastro(op('senior'))).toBe(true);
    expect(podeMexerNoCadastro(op('diretor'))).toBe(true);
    expect(podeMexerNoCadastro(op(null, true))).toBe(true);
    expect(podeMexerNoCadastro(op('pleno'))).toBe(false);
    expect(podeMexerNoCadastro(op('junior'))).toBe(false);
    expect(podeMexerNoCadastro(null)).toBe(false);
  });

  it('as Configurações: só Empresas para o sênior (os Usuários são do diretor e do admin; 09/11/2026); as do Admin só para o admin', () => {
    expect(cadastroDe(op('senior'))?.paginas.map(p => p.id)).toEqual(['empresas']);
    expect(cadastroDe(op('diretor'))?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios']);
    const doAdmin = cadastroDe(op('senior', true));
    expect(doAdmin?.nome).toBe('Configurações');
    expect(doAdmin?.paginas.map(p => p.id)).toEqual(['empresas', 'usuarios', 'visao-geral', 'robo', 'saude-robos', 'arquivador', 'uso', 'banco', 'cota', 'feedbacks', 'sistema', 'releitura']);
    expect(cadastroDe(op('pleno'))).toBeUndefined();
  });

  it('o Financeiro: o Diretor sempre; os outros só com o papel; o admin sem o nível não entra (09/11/2026)', () => {
    const vê = (o: Operador) => aplicacoesDe(o).some(a => a.id === 'financeiro');
    expect(vê(op('diretor'))).toBe(true);
    expect(vê({ ...op('diretor', true), financeiro: false })).toBe(true);
    expect(vê(op('senior', true))).toBe(false);
    expect(vê({ ...op('pleno'), nome: 'Nilma' })).toBe(false);
    expect(vê({ ...op('pleno'), financeiro: true })).toBe(true);
    expect(podeVerOFinanceiro(null)).toBe(false);
  });
});

describe('a Área do Cliente ainda não para o Fiscal (Vitor, 06/11/2026)', () => {
  const vê = (o: Operador) => aplicacoesDe(o).some(a => a.id === 'area-cliente');
  it('o Fiscal não vê (nem o diretor); o admin, o Contábil e o DP veem', () => {
    expect(vê({ ...op('pleno'), departamento: 'fiscal' })).toBe(false);
    expect(vê({ ...op('diretor'), departamento: 'fiscal' })).toBe(false);
    expect(vê({ ...op('senior', true), departamento: 'fiscal' })).toBe(true);
    expect(vê(op('pleno'))).toBe(true);
    expect(vê({ ...op('pleno'), departamento: 'dp' })).toBe(true);
  });
});

describe('Sênior, Pleno e Júnior: Entregas só o Painel, e o Início para todos (Vitor, 06/11/2026)', () => {
  const paginas = (o: Operador) => aplicacoesDe(o).find(a => a.id === 'entregas')?.paginas.map(p => p.id);
  it('quem não é Diretor só vê o Painel do Entregas; o Diretor e o admin veem tudo', () => {
    for (const n of ['senior', 'pleno', 'junior'] as const) expect(paginas({ ...op(n), departamento: 'fiscal' })).toEqual(['painel']);
    expect(paginas(op('diretor'))).toEqual(['nova', 'rota', 'painel', 'solicitacoes']);
    expect(paginas(op('pleno', true))).toEqual(['nova', 'rota', 'painel', 'solicitacoes']);
  });
  it('o Início volta para todo mundo', () => {
    for (const n of ['diretor', 'senior', 'pleno', 'junior'] as const) for (const d of ['fiscal', 'contabil', 'dp'] as const)
      expect(aplicacoesDe({ ...op(n), departamento: d }).some(a => a.id === 'inicio')).toBe(true);
  });
  it('só o Diretor (ou o admin) é Diretor', () => {
    expect(ehDiretor(op('diretor'))).toBe(true);
    expect(ehDiretor(op('junior', true))).toBe(true);
    for (const n of ['senior', 'pleno', 'junior'] as const) expect(ehDiretor(op(n))).toBe(false);
    expect(ehDiretor(null)).toBe(false);
  });
});

describe('os usuários cadastrados só para o Diretor e o admin (Vitor, 06/11/2026)', () => {
  const paginas = (o: Operador, app: string) => aplicacoesDe(o).find(a => a.id === app)?.paginas.map(p => p.id) ?? [];
  it('sênior, pleno e júnior não veem os Usuários; ninguém abaixo do diretor vê a Liberação de acessos', () => {
    for (const n of ['senior', 'pleno', 'junior'] as const) expect(paginas(op(n), 'cadastro')).not.toContain('usuarios');
    for (const n of ['senior', 'pleno', 'junior'] as const) expect(paginas(op(n), 'senhas')).not.toContain('acesso');
  });
  it('o diretor e o admin veem', () => {
    for (const o of [op('diretor'), op('pleno', true)]) {
      expect(paginas(o, 'cadastro')).toContain('usuarios');
      expect(paginas(o, 'senhas')).toContain('acesso');
    }
  });
});

// o módulo Desenvolvedor (13/11/2026): a Área do Cliente e a Central dos robôs dentro do nads, só no modo desenvolvedor
describe('o módulo Desenvolvedor', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const comModoDev = (ligado: boolean) => vi.stubGlobal('localStorage', { getItem: (k: string) => (ligado && k === 'nads-modo-desenvolvedor' ? '1' : null) });
  const vê = (o: Operador) => aplicacoesDe(o).some(a => a.id === 'desenvolvedor');

  it('aparece para quem é desenvolvedor, só com o modo ligado', () => {
    comModoDev(true);
    expect(vê({ ...op('diretor', true), desenvolvedor: true })).toBe(true);
    comModoDev(false);
    expect(vê({ ...op('diretor', true), desenvolvedor: true })).toBe(false);
  });

  it('quem não é desenvolvedor não vê, nem o admin, nem com a chave ligada', () => {
    comModoDev(true);
    expect(vê(op('diretor', true))).toBe(false);
    expect(vê(op('pleno'))).toBe(false);
  });
});
