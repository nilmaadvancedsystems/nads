import { describe, expect, it } from 'vitest';
import { linhaDaAuditoria, linhaDoRegistro, semDadoSensivel } from './registro';

describe('o registro das alterações sensíveis (E20)', () => {
  it('tira CPF, CNPJ e código', () => {
    expect(semDadoSensivel('CPF 123.456.789-09 e 12345678909')).toBe('CPF [CPF] e [CPF]');
    expect(semDadoSensivel('CNPJ 11.222.333/0001-81')).toBe('CNPJ [CNPJ]');
    expect(semDadoSensivel('código 482913 liberado')).toBe('código [código] liberado');
  });
  it('a linha: o detalhe curto, quem e quando', () => {
    const l = linhaDoRegistro('usuario-cargo', { email: 'a@x.com', nome: 'Vitor' }, 'x'.repeat(400), new Date('2026-11-22T12:00:00Z'));
    expect([l.acao, l.detalhe.length, l.feitoPorNome, l.quando, l.origem]).toEqual(['usuario-cargo', 300, 'Vitor', '2026-11-22T12:00:00.000Z', 'nads']);
  });
  it('a leitura da auditoria: a do nads com o rótulo; a dos robôs como veio', () => {
    expect(linhaDaAuditoria('1', { acao: 'usuario-excluido', detalhe: 'Clara', feitoPorNome: 'Vitor', quando: '2026-11-22T12:00:00Z', origem: 'nads' })?.rotulo).toBe('Excluiu a conta');
    expect(linhaDaAuditoria('2', { acao: 'recusa_de_documento', quando: '2026-11-22T12:00:00Z', origem: 'area-cliente' })).toMatchObject({ rotulo: 'recusa de documento', sensivel: false, origem: 'area-cliente' });
    expect(linhaDaAuditoria('3', { detalhe: 'x' })).toBeNull();
  });
});
