import { describe, expect, it } from 'vitest';
import { criarRhNetMemoria, pedidoRhNetDoBanco } from './rhNet';

describe('RH NET: os pedidos da fila (25/11/2026)', () => {
  it('lê o pedido que o robô respondeu, sem os dados pessoais', () => {
    const p = pedidoRhNetDoBanco('x', {
      tipo: 'rhnet', acao: 'admissao', codigo: 583, status: 'concluido', criadoEm: '2026-11-25T10:00:00.000Z', criadoPor: 'Ana', resumo: 'Admissão de MARIA',
      dados: null, rhnet: { admissao: { id: 15, situacao: 'nao_liberado', primeiroNome: 'MARIA', admissao: '2026-12-01' } },
    });
    expect(p).toMatchObject({ codigo: 583, acao: 'admissao', status: 'concluido', admissao: { id: 15, situacao: 'nao_liberado', primeiroNome: 'MARIA' } });
    expect(pedidoRhNetDoBanco('y', { acao: 'x', status: 'y' })).toMatchObject({ acao: 'cadastros', status: 'pendente', cadastros: null, admissao: null });
  });

  it('o exemplo confere a admissão antes de pedir', async () => {
    const r = criarRhNetMemoria();
    await expect(r.pedirAdmissao(583, { nome: 'Maria da Silva', cpf: '123', admissao: '2026-12-01' })).rejects.toThrow('o CPF não é válido');
    await r.pedirAdmissao(583, { nome: 'Maria da Silva', cpf: '529.982.247-25', admissao: '2026-12-01' });
    expect(r.pedidos().lista[0]).toMatchObject({ acao: 'admissao', admissao: { primeiroNome: 'MARIA' } });
  });
});
