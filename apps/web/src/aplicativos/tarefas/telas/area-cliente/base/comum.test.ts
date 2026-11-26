import { describe, expect, it } from 'vitest';
import { bate, ehFaltaDeRegra, haQuanto, plural } from './comum';

describe('as contas pequenas da Área do Cliente (26/11/2026)', () => {
  it('a busca sem acento, todas as palavras', () => {
    expect(bate('fito ind', 292, 'FITO INDÚSTRIA E COMÉRCIO')).toBe(true);
    expect(bate('fito ltda', 'FITO INDÚSTRIA')).toBe(false);
    expect(bate('292', 292, 'FITO')).toBe(true);
    expect(bate('  ', 'x')).toBe(true);
  });
  it('há quanto tempo', () => {
    const agora = new Date('2026-11-26T15:00:00');
    expect(haQuanto('2026-11-26T14:59:40', agora)).toBe('agora');
    expect(haQuanto('2026-11-26T14:30:00', agora)).toBe('há 30 min');
    expect(haQuanto('2026-11-26T12:00:00', agora)).toBe('há 3 h');
    expect(haQuanto('2026-11-25T12:00:00', agora)).toBe('ontem');
    expect(haQuanto('2026-11-22T12:00:00', agora)).toBe('há 4 dias');
    expect(haQuanto('2026-10-12T12:00:00', agora)).toBe('12/10/2026');
    expect(haQuanto('', agora)).toBe('');
  });
  it('o erro de regra do banco e o plural', () => {
    expect(ehFaltaDeRegra(new Error('Missing or insufficient permissions.'))).toBe(true);
    expect(ehFaltaDeRegra(new Error('rede'))).toBe(false);
    expect(plural(1, 'arquivo', 'arquivos')).toBe('1 arquivo');
    expect(plural(3, 'arquivo', 'arquivos')).toBe('3 arquivos');
  });
});
