// A Área do Cliente com senha, uma por pessoa (18/11/2026).
import { describe, expect, it } from 'vitest';
import { clienteAbreOLink, erroDaPessoa, mesmasPermissoes, permissoesPorEmail } from './acessoPorPessoa';

const t = (c: string) => c.repeat(40);

describe('o acesso por pessoa', () => {
  it('confere o nome e o e-mail', () => {
    expect(erroDaPessoa({ nome: 'Maria', email: ' Maria@Padaria.com.br ' })).toBe('');
    expect(erroDaPessoa({ nome: 'M', email: 'maria@padaria.com' })).toMatch(/nome/);
    expect(erroDaPessoa({ nome: 'Maria', email: 'maria@' })).toMatch(/e-mail/);
  });
  it('junta os links de todas as fichas ativas do mesmo e-mail; o torto fica de fora', () => {
    const p = permissoesPorEmail([
      { email: 'Maria@x.com', tokens: [t('b'), 'torto'], ativo: true },
      { email: 'maria@x.com ', tokens: [t('a')], ativo: true },
      { email: 'maria@x.com', tokens: [t('c')], ativo: false },
      { email: 'joao@x.com', tokens: [t('a')], ativo: false },
    ]);
    expect(p.get('maria@x.com')).toEqual({ cliente: true, a: [t('a'), t('b')] });
    // quem só tem fichas desligadas fica sem link nenhum (o robô tira e derruba as sessões)
    expect(p.get('joao@x.com')).toEqual({ cliente: true, a: [] });
  });
  it('no máximo 20 links por pessoa', () => {
    const tokens = Array.from({ length: 25 }, (_, i) => i.toString(16).padStart(2, '0').repeat(20));
    expect(permissoesPorEmail([{ email: 'a@b.com', tokens, ativo: true }]).get('a@b.com')!.a).toHaveLength(20);
  });
  it('só grava quando mudou; a tela confere o link como o banco', () => {
    const nova = { cliente: true as const, a: [t('a')] };
    expect(mesmasPermissoes({ cliente: true, a: [t('a')] }, nova)).toBe(true);
    expect(mesmasPermissoes({ cliente: true, a: [] }, nova)).toBe(false);
    expect(mesmasPermissoes(undefined, nova)).toBe(false);
    expect(clienteAbreOLink({ cliente: true, a: [t('a')] }, t('a'))).toBe(true);
    expect(clienteAbreOLink({ cliente: true, a: [t('a')] }, t('b'))).toBe(false);
    expect(clienteAbreOLink({ a: [t('a')] }, t('a'))).toBe(false);
  });
});
