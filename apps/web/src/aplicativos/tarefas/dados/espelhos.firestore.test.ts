import { describe, expect, it } from 'vitest';
import { espelhoVale } from './espelhos.firestore';

describe('o espelho dos clientes e do cadastro (robo/espelhos.js)', () => {
  const agora = Date.parse('2026-11-12T15:00:00Z');
  const h = (n: number) => new Date(agora - n * 36e5).toISOString();
  it('vale com documentos (ou partes) e o sinal do robô nas últimas 12 h', () => {
    expect(espelhoVale({ vivoEm: h(1), docs: {} }, agora)).toBe(true);
    expect(espelhoVale({ vivoEm: h(11), partes: 2 }, agora)).toBe(true);
  });
  it('sem espelho, velho ou vazio: as telas ouvem a coleção', () => {
    expect(espelhoVale(undefined, agora)).toBe(false);
    expect(espelhoVale({ vivoEm: h(13), docs: {} }, agora)).toBe(false);
    expect(espelhoVale({ vivoEm: h(1) }, agora)).toBe(false);
    expect(espelhoVale({ docs: {} }, agora)).toBe(false);
  });
});
