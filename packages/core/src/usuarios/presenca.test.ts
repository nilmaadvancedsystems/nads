import { describe, expect, it } from 'vitest';
import { estaOnline, rotuloDaPresenca } from '.';

const agora = new Date('2026-10-05T14:00:00.000Z');
const antes = (min: number) => new Date(agora.getTime() - min * 60000).toISOString();

describe('presença no nads', () => {
  it('online até 5 minutos sem sinal', () => {
    expect(estaOnline(antes(1), agora)).toBe(true);
    expect(estaOnline(antes(4.9), agora)).toBe(true);
    expect(estaOnline(antes(5), agora)).toBe(false);
    expect(estaOnline(null, agora)).toBe(false);
    expect(estaOnline('lixo', agora)).toBe(false);
  });
  it('o rótulo: online, minutos, horas, dias ou nunca', () => {
    expect(rotuloDaPresenca(antes(2), agora)).toBe('Online');
    expect(rotuloDaPresenca(antes(12), agora)).toBe('Visto há 12 min');
    expect(rotuloDaPresenca(antes(180), agora)).toBe('Visto há 3 h');
    expect(rotuloDaPresenca(antes(60 * 24), agora)).toBe('Visto há 1 dia');
    expect(rotuloDaPresenca(antes(60 * 72), agora)).toBe('Visto há 3 dias');
    expect(rotuloDaPresenca(undefined, agora)).toBe('Nunca abriu o nads');
  });
});
