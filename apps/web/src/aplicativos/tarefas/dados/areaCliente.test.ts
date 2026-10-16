import { describe, expect, it } from 'vitest';
import { criarAreaClienteMemoria, enderecoDoLink, novoToken, textoDoWhatsApp, tokenValido } from './areaCliente';

describe('o token do link', () => {
  it('tem 40 hexadecimais minúsculos e não repete', () => {
    const a = novoToken();
    expect(tokenValido(a)).toBe(true);
    expect(novoToken()).not.toBe(a);
  });
  it('o endereço e o texto do WhatsApp levam o link', () => {
    const t = 'a'.repeat(40);
    expect(enderecoDoLink(t)).toBe('https://cliente.nilmacontabilidade.com/cliente/' + t);
    expect(textoDoWhatsApp('ACME LTDA', enderecoDoLink(t))).toContain(enderecoDoLink(t));
  });
});

describe('a Área do Cliente de exemplo (memória)', () => {
  const repo = () => criarAreaClienteMemoria(() => 'Vitor');
  it('começa com links válidos, 2 chamados com conversa e 3 recebidos', () => {
    const r = repo();
    expect(r.links().lista.length).toBeGreaterThanOrEqual(3);
    expect(r.links().lista.every(l => tokenValido(l.token))).toBe(true);
    expect(r.chamados().lista).toHaveLength(2);
    expect(r.chamados().lista.every(c => c.mensagens.length >= 2)).toBe(true);
    expect(r.recebidos().lista).toHaveLength(3);
  });
  it('gerar, trocar e revogar', async () => {
    const r = repo();
    const e = { codigo: 205, nome: 'ADEMILSON OLIVEIRA CRUZ' };
    const gerado = await r.gerar(e);
    expect(r.links().lista.find(l => l.codigo === 205)?.token).toBe(gerado.token);
    expect((await r.gerar(e)).token).toBe(gerado.token);
    const novo = await r.trocar(e);
    expect(novo.token).not.toBe(gerado.token);
    expect(r.links().lista.filter(l => l.codigo === 205)).toHaveLength(1);
    await r.revogar(205);
    expect(r.links().lista.some(l => l.codigo === 205)).toBe(false);
  });
  it('responder acrescenta a mensagem do escritório e passa para respondido', async () => {
    const r = repo();
    const antes = r.chamados().lista.find(c => c.id === 'ex-1')!;
    const v = r.versao();
    await r.responder('ex-1', 'No consultório do trabalho.');
    const depois = r.chamados().lista.find(c => c.id === 'ex-1')!;
    expect(depois.mensagens).toHaveLength(antes.mensagens.length + 1);
    expect(depois.mensagens.at(-1)).toMatchObject({ de: 'escritorio', autor: 'Vitor' });
    expect(depois.situacao).toBe('respondido');
    expect(r.versao()).toBeGreaterThan(v);
    await r.mudarSituacao('ex-1', 'concluido');
    expect(r.chamados().lista.find(c => c.id === 'ex-1')?.situacao).toBe('concluido');
  });
});
