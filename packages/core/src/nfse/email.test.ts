import { describe, expect, it } from 'vitest';
import { AVISO_SEM_VALOR, CONFIG_PADRAO, configDoEmail, EMAIL_PADRAO, emailValido, mensagemDaNota, preencherModelo } from './index';

const nota = { tomador: { nome: 'CLIENTE EXEMPLO LTDA' }, numeroNfse: '2600000004099', servico: { valor: 1250.5, competencia: '2026-09-30' }, ambiente: 'producao' };

describe('a NFS-e por e-mail ao cliente', () => {
  it('vem desligada na configuração padrão, com assunto e texto prontos', () => {
    expect(CONFIG_PADRAO.email).toEqual(EMAIL_PADRAO);
    expect(CONFIG_PADRAO.email.automatico).toBe(false);
    expect(CONFIG_PADRAO.email.assunto).toBe('NFS-e {numero} — Nilma Contabilidade');
    for (const campo of ['{cliente}', '{numero}', '{valor}', '{competencia}']) expect(CONFIG_PADRAO.email.texto).toContain(campo);
  });

  it('completa a configuração do banco com a padrão', () => {
    expect(configDoEmail(undefined)).toEqual(EMAIL_PADRAO);
    expect(configDoEmail({ automatico: true, assunto: '  ', texto: 'Oi {cliente}' })).toEqual({ automatico: true, assunto: EMAIL_PADRAO.assunto, texto: 'Oi {cliente}' });
    expect(configDoEmail({ automatico: 'sim' }).automatico).toBe(false);
  });

  it('preenche o modelo com os dados da nota', () => {
    const m = mensagemDaNota(nota);
    expect(m.assunto).toBe('NFS-e 2600000004099 — Nilma Contabilidade');
    expect(m.texto).toContain('Olá, CLIENTE EXEMPLO LTDA!');
    expect(m.texto).toContain('nº 2600000004099, no valor de R$ 1.250,50, referente a 09/2026');
    expect(preencherModelo('{cliente} {desconhecido}', { cliente: 'X' })).toBe('X {desconhecido}');
  });

  it('avisa no assunto e no texto quando a nota é de homologação', () => {
    const m = mensagemDaNota({ ...nota, ambiente: 'homologacao' }, { automatico: true, assunto: 'Nota {numero}', texto: 'Segue.' });
    expect(m.assunto).toBe('[SEM VALOR FISCAL] Nota 2600000004099');
    expect(m.texto).toBe(AVISO_SEM_VALOR + '\n\nSegue.');
  });

  it('confere o e-mail', () => {
    expect(emailValido('financeiro@cliente.com.br')).toBe(true);
    expect(emailValido(' financeiro@cliente.com.br ')).toBe(true);
    expect(emailValido('sem-arroba')).toBe(false);
    expect(emailValido('a@b')).toBe(false);
    expect(emailValido('')).toBe(false);
  });
});
