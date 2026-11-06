// Os outros e-mails da empresa (05/11/2026): o DP Envios manda para o principal e para eles.
import { describe, expect, it } from 'vitest';
import { cadastroDoDocumento, cadastroVazio, definirContato, definirOutrosEmails, outrosEmailsLimpos } from './regras';

const agora = new Date('2026-11-05T12:00:00');

describe('outros e-mails da empresa', () => {
  it('grava em minúsculas, sem repetir, e não mexe no principal', () => {
    const c = definirContato(cadastroVazio('FITO', 292), 'email', 'financeiro@fito.com.br', 'Nilma', agora);
    const d = definirOutrosEmails(c, ['Dono@Fito.com.br', 'dono@fito.com.br', 'contato@fito.com.br'], 'Nilma', agora);
    expect(d.contato).toEqual({ email: 'financeiro@fito.com.br', outrosEmails: ['dono@fito.com.br', 'contato@fito.com.br'] });
  });

  it('e-mail inválido não grava (quem chama avisa)', () => {
    const c = cadastroVazio('FITO', 292);
    expect(definirOutrosEmails(c, ['ok@fito.com.br', 'sem-arroba'], 'Nilma', agora)).toBe(c);
  });

  it('lista vazia tira os extras e o contato some se não sobrar nada', () => {
    const c = definirOutrosEmails(cadastroVazio('FITO', 292), ['dono@fito.com.br'], 'Nilma', agora);
    const d = definirOutrosEmails(c, [], 'Nilma', agora);
    expect(d.contato).toBeUndefined();
  });

  it('o documento guardado mantém os extras', () => {
    const c = cadastroDoDocumento('FITO', 292, { contato: { email: 'a@x.com.br', outrosEmails: ['B@x.com.br', 'lixo'] } });
    expect(c.contato).toEqual({ email: 'a@x.com.br', outrosEmails: ['b@x.com.br'] });
  });

  it('outrosEmailsLimpos tira os inválidos e repetidos', () => {
    expect(outrosEmailsLimpos([' A@x.com ', 'a@x.com', 'nope'])).toEqual(['a@x.com']);
  });
});
