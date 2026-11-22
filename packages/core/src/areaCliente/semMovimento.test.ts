import { describe, expect, it } from 'vitest';
import { competenciaAceitaNoSemMovimento, competenciaDoPedidoDeSemMovimento, pedidoDeSemMovimento } from './semMovimento';

describe('"Não tive movimento" pela Área do Cliente', () => {
  it('o pedido marcado vai e volta', () => {
    const p = pedidoDeSemMovimento('2026-10');
    expect(p).toEqual({ tipo: 'documento', titulo: 'SEM MOVIMENTO', texto: 'semmovimento:2026-10' });
    expect(competenciaDoPedidoDeSemMovimento(p)).toBe('2026-10');
  });
  it('torto ou outro pedido: nada', () => {
    expect(pedidoDeSemMovimento('2026-13')).toBeNull();
    expect(competenciaDoPedidoDeSemMovimento({ tipo: 'documento', titulo: 'RECEBI', texto: 'semmovimento:2026-10' })).toBe('');
    expect(competenciaDoPedidoDeSemMovimento({ tipo: 'duvida', titulo: 'SEM MOVIMENTO', texto: 'semmovimento:2026-10' })).toBe('');
    expect(competenciaDoPedidoDeSemMovimento({ tipo: 'documento', titulo: 'SEM MOVIMENTO', texto: 'semmovimento:x' })).toBe('');
  });
  it('só o mês anterior e o atual', () => {
    const hoje = new Date(2026, 10, 22);
    expect(competenciaAceitaNoSemMovimento('2026-10', hoje)).toBe(true);
    expect(competenciaAceitaNoSemMovimento('2026-11', hoje)).toBe(true);
    expect(competenciaAceitaNoSemMovimento('2026-09', hoje)).toBe(false);
    expect(competenciaAceitaNoSemMovimento('2027-01', new Date(2027, 0, 5))).toBe(true);
    expect(competenciaAceitaNoSemMovimento('2026-12', new Date(2027, 0, 5))).toBe(true);
  });
});
