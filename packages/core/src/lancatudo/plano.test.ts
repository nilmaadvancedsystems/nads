// O plano de contas em árvore do Lançatudo (a janela de escolher a conta, como no eContador).
import { describe, expect, it } from 'vitest';
import type { ContaDoPlano } from '../empresas/cadastro/tipos';
import { gruposFechadosNoInicio, linhasDoPlano, linhasVisiveisDoPlano } from './index';

let n = 0;
const c = (codigo: string, nome: string, classificacao?: string, sintetica = false): ContaDoPlano => ({ codigo, nome, ordem: n++, ...(classificacao ? { classificacao } : {}), ...(sintetica ? { sintetica } : {}) });

const PLANO: ContaDoPlano[] = [
  c('1', 'ATIVO', '1', true),
  c('2', 'ATIVO CIRCULANTE', '1.1', true),
  c('3', 'DISPONÍVEL', '1.1.1', true),
  c('10101', 'Caixa geral', '1.1.1.01'),
  c('10503', 'Banco Sicoob c/ movimento', '1.1.1.02'),
  c('4', 'CLIENTES', '1.1.2', true),
  c('11201', 'Cliente Alfa', '1.1.2.01'),
  c('5', 'PASSIVO', '2', true),
  c('20501', 'Simples Nacional a recolher', '2.1'),
];

describe('o plano em árvore', () => {
  const linhas = linhasDoPlano(PLANO);

  it('o nível e os grupos de cima pela classificação', () => {
    expect(linhas.find(l => l.codigo === '10503')).toMatchObject({ nivel: 4, pais: ['1', '2', '3'], sintetica: false, temFilhos: false });
    expect(linhas.find(l => l.codigo === '11201')?.pais).toEqual(['1', '2', '4']);
    expect(linhas.find(l => l.codigo === '20501')).toMatchObject({ nivel: 2, pais: ['5'] });
    expect(linhas.find(l => l.codigo === '3')).toMatchObject({ temFilhos: true, nivel: 3 });
  });

  it('sem classificação, pela ordem: a sintética abre o grupo das analíticas que vêm depois', () => {
    const sem = linhasDoPlano([c('1', 'ATIVO', undefined, true), c('2', 'DISPONÍVEL', undefined, true), c('10101', 'Caixa'), c('5', 'PASSIVO', undefined, true), c('20501', 'Simples')]);
    expect(sem.map(l => [l.codigo, l.nivel, l.pais.join('>')])).toEqual([['1', 1, ''], ['2', 2, '1'], ['10101', 3, '1>2'], ['5', 1, ''], ['20501', 2, '5']]);
  });

  it('o grupo fechado esconde o que está debaixo; a busca mostra o que casa e os grupos de cima', () => {
    expect(linhasVisiveisDoPlano(linhas, '', new Set(['3'])).map(l => l.codigo)).toEqual(['1', '2', '3', '4', '11201', '5', '20501']);
    expect(linhasVisiveisDoPlano(linhas, 'sicoob', new Set(['3'])).map(l => l.codigo)).toEqual(['1', '2', '3', '10503']);
    expect(linhasVisiveisDoPlano(linhas, '112', new Set()).map(l => l.codigo)).toEqual(['1', '2', '4', '11201']);
    expect(linhasVisiveisDoPlano(linhas, '1.1.1.0', new Set()).map(l => l.codigo)).toEqual(['1', '2', '3', '10101', '10503']);
    expect(linhasVisiveisDoPlano(linhas, 'disponivel', new Set()).map(l => l.codigo)).toEqual(['1', '2', '3']);
  });

  it('começa com os grupos de baixo fechados', () => {
    expect([...gruposFechadosNoInicio(linhas)].sort()).toEqual(['3', '4']);
  });
});
