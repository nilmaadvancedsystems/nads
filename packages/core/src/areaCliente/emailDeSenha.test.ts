// O e-mail de senha pelo robô (19/11/2026).
import { describe, expect, it } from 'vitest';
import { emailDeSenha, linkDaPaginaDeSenha, pedidoDeSenha } from './emailDeSenha';

const T = 'a'.repeat(40);

describe('o e-mail de senha pelo robô', () => {
  it('confere o pedido', () => {
    expect(pedidoDeSenha(T, ' Maria@Padaria.com ')).toEqual({ token: T, email: 'maria@padaria.com' });
    expect(pedidoDeSenha('torto', 'maria@padaria.com')).toBeNull();
    expect(pedidoDeSenha(T, 'maria@')).toBeNull();
  });
  it('leva só o código para a página própria', () => {
    expect(linkDaPaginaDeSenha('https://entregas-2e5e2.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABCdef_123-xyz&apiKey=K&lang=en'))
      .toBe('https://cliente.nilmacontabilidade.com/cliente/senha?mode=resetPassword&oobCode=ABCdef_123-xyz');
    expect(linkDaPaginaDeSenha('https://x.com/?mode=resetPassword')).toBeNull();
    expect(linkDaPaginaDeSenha('não é link')).toBeNull();
  });
  it('o texto em português, com o link e a empresa', () => {
    const e = emailDeSenha('PADARIA BOA', 'https://cliente.nilmacontabilidade.com/cliente/senha?oobCode=x');
    expect(e.assunto).toMatch(/senha/);
    expect(e.texto).toContain('PADARIA BOA');
    expect(e.texto).toContain('https://cliente.nilmacontabilidade.com/cliente/senha?oobCode=x');
  });
});
