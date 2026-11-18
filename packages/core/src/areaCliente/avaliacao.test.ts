// A avaliação do atendimento (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento).
import { describe, expect, it } from 'vitest';
import { guiaDoPedidoDeLeitura } from './leitura';
import { entregaDoPedidoDeRecebido } from './entregaRecebida';
import { avaliacaoDoPedido, MAIOR_COMENTARIO_DA_AVALIACAO, mediaDasAvaliacoes, pedidoDeAvaliacao } from './avaliacao';

describe('a avaliação do atendimento', () => {
  it('cria e reconhece a marca, com e sem comentário', () => {
    const p = pedidoDeAvaliacao('c123', 5, '  Muito rápidos!  ')!;
    expect(p).toEqual({ tipo: 'documento', titulo: 'AVALIACAO', texto: 'chamado:c123 nota:5\nMuito rápidos!' });
    expect(avaliacaoDoPedido(p)).toEqual({ chamadoId: 'c123', nota: 5, comentario: 'Muito rápidos!' });
    expect(avaliacaoDoPedido(pedidoDeAvaliacao('c123', 2, ''))).toEqual({ chamadoId: 'c123', nota: 2, comentario: '' });
  });
  it('recusa nota fora de 1 a 5 e id torto; corta o comentário em 500', () => {
    expect(pedidoDeAvaliacao('c1', 0, '')).toBeNull();
    expect(pedidoDeAvaliacao('c1', 6, '')).toBeNull();
    expect(pedidoDeAvaliacao('c1', 4.5, '')).toBeNull();
    expect(pedidoDeAvaliacao('../x', 5, '')).toBeNull();
    expect(pedidoDeAvaliacao('c1', 3, 'x'.repeat(900))!.texto.length).toBe('chamado:c1 nota:3\n'.length + MAIOR_COMENTARIO_DA_AVALIACAO);
    expect(avaliacaoDoPedido({ tipo: 'documento', titulo: 'AVALIACAO', texto: 'chamado:c1 nota:9' })).toBeNull();
  });
  it('não se confunde com chamado comum nem com os outros pedidos marcados', () => {
    const p = pedidoDeAvaliacao('c1', 4, 'ok')!;
    expect(guiaDoPedidoDeLeitura(p)).toBe('');
    expect(entregaDoPedidoDeRecebido(p)).toBe('');
    expect(avaliacaoDoPedido({ tipo: 'documento', titulo: 'Preciso da certidão', texto: 'chamado:c1 nota:4' })).toBeNull();
  });
  it('a média do mês, com uma casa', () => {
    const a = [{ nota: 5, em: '2026-11-02T10:00:00Z' }, { nota: 4, em: '2026-11-10T10:00:00Z' }, { nota: 4, em: '2026-11-11T10:00:00Z' }, { nota: 1, em: '2026-10-30T10:00:00Z' }];
    expect(mediaDasAvaliacoes(a, '2026-11')).toEqual({ media: 4.3, total: 3 });
    expect(mediaDasAvaliacoes(a, '2026-09')).toEqual({ media: 0, total: 0 });
  });
});
