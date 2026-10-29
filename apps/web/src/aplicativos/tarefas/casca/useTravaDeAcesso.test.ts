// A trava de acesso: sem sessão (exemplos) fica aberta; com sessão, pede a entrada e só passa quem tem o papel.
import { usuarios } from '@nads/core';
import { describe, expect, it } from 'vitest';
import { faseDaTrava, papeisQueLiberam } from './useTravaDeAcesso';

const por = (nome: string) => usuarios.EQUIPE_EXEMPLO.find(u => u.nome === nome)!;
const EXTRATUDO = ['extrator', 'cheque-especial', 'creditor'] as const;

describe('trava de acesso', () => {
  it('sem sessão (exemplos) fica aberta', () => {
    expect(faseDaTrava(null, ['conferencia'])).toBe('aberta');
  });
  it('com sessão e ninguém entrou: a entrada', () => {
    expect(faseDaTrava({ usuario: null }, ['conferencia'])).toBe('entrar');
  });
  it('o contábil passa; o fiscal vê o sem acesso; o admin passa em tudo', () => {
    expect(faseDaTrava({ usuario: por('Clara') }, ['conferencia'])).toBe('aberta');
    expect(faseDaTrava({ usuario: por('Heverton') }, EXTRATUDO)).toBe('sem-acesso');
    expect(faseDaTrava({ usuario: por('Sávio') }, ['conciliadorzinho'])).toBe('aberta');
  });
  it('conta desativada não passa', () => {
    expect(faseDaTrava({ usuario: { ...por('Nilma'), ativo: false } }, ['conferencia'])).toBe('sem-acesso');
  });
  it('diz quais papéis liberam', () => {
    expect(papeisQueLiberam(EXTRATUDO)).toBe('Contábil ou Admin');
  });
});
