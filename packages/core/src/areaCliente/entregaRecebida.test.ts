// O cliente confirma a entrega pela Área (plano do Acessórias, 18/11/2026, ficha confirmar-entrega).
import { describe, expect, it } from 'vitest';
import { guiaDoPedidoDeLeitura } from './leitura';
import { entregaDoPedidoDeRecebido, entregasParaConfirmar, pedidoDeRecebido } from './entregaRecebida';

describe('confirmar a entrega', () => {
  it('cria e reconhece a marca; recusa id torto e não confunde com a leitura', () => {
    const p = pedidoDeRecebido('ent123abc')!;
    expect(p).toEqual({ tipo: 'documento', titulo: 'RECEBI', texto: 'recebi:ent123abc' });
    expect(entregaDoPedidoDeRecebido(p)).toBe('ent123abc');
    expect(pedidoDeRecebido('x')).toBeNull();
    expect(entregaDoPedidoDeRecebido({ tipo: 'documento', titulo: 'RECEBI', texto: 'recebi:../x' })).toBe('');
    expect(guiaDoPedidoDeLeitura(p)).toBe('');
  });
  it('só as entregas que esperam no link; a de rota não tem botão', () => {
    const r = entregasParaConfirmar([
      { id: 'ent000001', status: 'link', competencia: '2026-10', itens: [{ tipo: 'DAS' }] },
      { id: 'ent000002', status: 'pendente', competencia: '2026-10', itens: [{ tipo: 'FGTS' }] },
      { id: 'ent000003', status: 'confirmada', competencia: '2026-10' },
      { id: 'ent000004', status: 'link', competencia: '2026-10', itens: [{ tipo: 'DAS' }, { tipo: 'FGTS' }] },
    ]);
    expect(r).toEqual([{ id: 'ent000001', titulo: 'DAS de outubro', competencia: '2026-10' }, { id: 'ent000004', titulo: 'Documentos de outubro', competencia: '2026-10' }]);
  });
});
