import { describe, expect, it } from 'vitest';
import { lerPassos, marcarPasso, passoAtual, passosDoTipo } from './chamados';

describe('o passo atual do pedido (2A.14)', () => {
  it('só a admissão, a demissão e as férias têm passos', () => {
    expect(passosDoTipo('admissao').length).toBe(4);
    expect(passosDoTipo('duvida')).toEqual([]);
  });
  it('o atual é o último marcado; o cliente vê um só', () => {
    expect(passoAtual('admissao', {})).toBeNull();
    expect(passoAtual('admissao', { 'Pedido recebido': 'a', 'Documentos conferidos': 'b' })).toEqual({ nome: 'Documentos conferidos', n: 2, total: 4 });
  });
  it('marcar leva os anteriores; desmarcar tira os seguintes', () => {
    const m = marcarPasso('admissao', {}, 'eSocial enviado', true, 'x');
    expect(Object.keys(m)).toEqual(['Pedido recebido', 'Documentos conferidos', 'eSocial enviado']);
    expect(Object.keys(marcarPasso('admissao', m, 'Documentos conferidos', false, 'y'))).toEqual(['Pedido recebido']);
  });
  it('a leitura joga fora o passo estranho', () => {
    expect(lerPassos('ferias', { 'Pedido recebido': '2026-11-23', 'Motivo da demissão': 'x', 'Recibo pronto': 3 })).toEqual({ 'Pedido recebido': '2026-11-23' });
  });
});
