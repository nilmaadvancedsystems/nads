import { describe, expect, it } from 'vitest';
import { erroDeAmbiente, pedidoAproveitavel, PRONTO_VALE_MS } from './razaoDoRobo.regras';

const agora = Date.parse('2026-11-06T18:00:00Z');
const iso = (msAtras: number) => new Date(agora - msAtras).toISOString();

describe('pedidoAproveitavel', () => {
  it('reaproveita o pendente/trabalhando mais antigo', () => {
    const l = [{ id: 'b', status: 'pendente', criadoEm: iso(1000) }, { id: 'a', status: 'trabalhando', criadoEm: iso(5000) }];
    expect(pedidoAproveitavel(l, agora)).toBe('a');
  });
  it('reaproveita o pronto recente, não o velho nem o com erro', () => {
    expect(pedidoAproveitavel([{ id: 'p', status: 'pronto', criadoEm: iso(60_000) }], agora)).toBe('p');
    expect(pedidoAproveitavel([{ id: 'p', status: 'pronto', criadoEm: iso(PRONTO_VALE_MS + 1000) }], agora)).toBeNull();
    expect(pedidoAproveitavel([{ id: 'e', status: 'erro', criadoEm: iso(1000) }, { id: 'c', status: 'cancelado', criadoEm: iso(1000) }], agora)).toBeNull();
  });
  it('usa a hora de terminar quando existe e ignora pronto sem razão lido', () => {
    expect(pedidoAproveitavel([{ id: 'p', status: 'pronto', criadoEm: iso(PRONTO_VALE_MS * 3), fimEm: iso(1000) }], agora)).toBe('p');
    expect(pedidoAproveitavel([{ id: 'p', status: 'pronto', criadoEm: iso(1000), razaoLido: false }], agora)).toBeNull();
  });
  it('pedir de novo de propósito não reaproveita o pronto', () => {
    expect(pedidoAproveitavel([{ id: 'p', status: 'pronto', criadoEm: iso(1000) }], agora, false)).toBeNull();
    expect(pedidoAproveitavel([{ id: 'x', status: 'pendente', criadoEm: iso(1000) }], agora, false)).toBe('x');
  });
});

describe('erroDeAmbiente', () => {
  it('reconhece Contábil fora e falta de tela', () => {
    expect(erroDeAmbiente('a janela não abriu')).toBe(true);
    expect(erroDeAmbiente('SendInput: 0 eventos')).toBe(true);
    expect(erroDeAmbiente('conta 1.1.01 não encontrada')).toBe(false);
  });
});
