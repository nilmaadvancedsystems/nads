// O registro de abertura da guia (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura).
import { describe, expect, it } from 'vitest';
import { chaveDoPedidoDeDanfe } from './pedidoDeDanfe';
import { guiaDoPedidoDeLeitura, idDaLeitura, jaRegistrouHoje, pedidoDeLeitura } from './leitura';

describe('o pedido de leitura da guia', () => {
  it('cria e reconhece a marca', () => {
    const p = pedidoDeLeitura('darf-inss-2026-10-58')!;
    expect(p).toEqual({ tipo: 'documento', titulo: 'LEITURA', texto: 'guia:darf-inss-2026-10-58' });
    expect(guiaDoPedidoDeLeitura(p)).toBe('darf-inss-2026-10-58');
  });
  it('recusa id torto e o chamado comum', () => {
    expect(pedidoDeLeitura('../x')).toBeNull();
    expect(pedidoDeLeitura('')).toBeNull();
    expect(guiaDoPedidoDeLeitura({ tipo: 'documento', titulo: 'LEITURA', texto: 'guia:a/b' })).toBe('');
    expect(guiaDoPedidoDeLeitura({ tipo: 'duvida', titulo: 'LEITURA', texto: 'guia:abc' })).toBe('');
    expect(guiaDoPedidoDeLeitura({ tipo: 'documento', titulo: 'Preciso da guia', texto: 'guia:abc' })).toBe('');
  });
  it('não confunde com o pedido de DANFE', () => {
    expect(chaveDoPedidoDeDanfe(pedidoDeLeitura('das-2026-10-58'))).toBe('');
    expect(guiaDoPedidoDeLeitura({ tipo: 'documento', titulo: 'DANFE', texto: 'danfe:123' })).toBe('');
  });
  it('o id do registro e uma vez por dia', () => {
    expect(idDaLeitura('tok', 'das-2026-10-58')).toBe('tok_das-2026-10-58');
    expect(jaRegistrouHoje({ 'tok|g1': '2026-11-17' }, 'tok|g1', '2026-11-17')).toBe(true);
    expect(jaRegistrouHoje({ 'tok|g1': '2026-11-16' }, 'tok|g1', '2026-11-17')).toBe(false);
  });
});
