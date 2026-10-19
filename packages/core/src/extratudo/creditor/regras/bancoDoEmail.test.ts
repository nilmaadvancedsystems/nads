import { describe, expect, it } from 'vitest';
import { anexoDoBanco, bancoDaLinha, separarPeloBanco } from './bancoDoEmail';

// nomes inventados
const A = (nome: string, assunto = '', trecho = '') => ({ nome, assunto, trecho });

describe('o banco do anexo no Buscar no e-mail (19/10/2026)', () => {
  it('o banco da linha, pelo nome e pelo id', () => {
    expect([bancoDaLinha('Nubank', 'nubank'), bancoDaLinha('Conta principal', 'banco-do-brasil'), bancoDaLinha('BNB', 'bnb'), bancoDaLinha('Banco', 'banco')])
      .toEqual(['Nubank', 'Banco do Brasil', 'Banco do Nordeste', '']);
  });
  it('o nome do anexo manda: o de outro banco some, mesmo com o procurado no e-mail', () => {
    const anexos = [
      A('EXTRATO SICOOB JAN2026.pdf', 'EXTRATOS BANCÁRIOS EMPRESA EXEMPLO'),
      A('EXTRATO NUBANK JAN2026.pdf', 'EXTRATOS BANCÁRIOS EMPRESA EXEMPLO'),
      A('EXTRATO BNB JAN2026.pdf', 'EXTRATOS SICOOB E NUBANK'),
    ];
    expect(separarPeloBanco(anexos, 'Nubank').doBanco.map(a => a.nome)).toEqual(['EXTRATO NUBANK JAN2026.pdf']);
  });
  it('sem banco no nome: só outro banco no assunto e no corpo, some; o procurado (sozinho ou junto) ou nenhum, fica', () => {
    expect(anexoDoBanco(A('extrato.pdf', 'Extrato Sicoob janeiro'), 'Nubank')).toBe(false);
    expect(anexoDoBanco(A('extrato.pdf', 'Extratos', 'segue o Sicoob e o Nubank'), 'Nubank')).toBe(true);
    expect(anexoDoBanco(A('extrato.pdf', 'Extrato de janeiro', 'segue em anexo, caixa de entrada cheia'), 'Nubank')).toBe(true);
    expect(anexoDoBanco(A('extrato.pdf', 'Extrato Sicoob'), '')).toBe(true);
  });
  it('as abreviações: BB é o Banco do Brasil, BNB o do Nordeste', () => {
    expect(anexoDoBanco(A('EXTRATO BB JAN2026.pdf'), 'Banco do Brasil')).toBe(true);
    expect(anexoDoBanco(A('EXTRATO BB JAN2026.pdf'), 'Banco do Nordeste')).toBe(false);
    expect(anexoDoBanco(A('EXTRATO BNB JAN2026.pdf'), 'Banco do Brasil')).toBe(false);
  });
});
