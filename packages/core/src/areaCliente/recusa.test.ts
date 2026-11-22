import { describe, expect, it } from 'vitest';
import { erroDaRecusa, pedidoDeRecusa, recusaLida } from './recusa';
import { reciboDoEnvio } from './envios';

describe('a recusa do documento (22/11/2026)', () => {
  it('o motivo é obrigatório e curto', () => {
    expect(erroDaRecusa('  ')).not.toBe('');
    expect(erroDaRecusa('x'.repeat(301))).not.toBe('');
    expect(erroDaRecusa('É de outro mês')).toBe('');
  });
  it('o pedido leva quem recusou e sai como não tratado', () => {
    const p = pedidoDeRecusa(' É de outro mês ', 'Clara', 'uid1', new Date('2026-11-22T12:00:00Z'));
    expect(p).toEqual({ motivo: 'É de outro mês', por: 'Clara', porUid: 'uid1', em: '2026-11-22T12:00:00.000Z', tratada: false });
    expect(pedidoDeRecusa('ok?', 'Clara', '', new Date())).toBeNull();
  });
  it('o robô lê só a recusa que serve', () => {
    expect(recusaLida({ motivo: 'Faltam páginas', por: 'Clara', em: 'x' })).toEqual({ motivo: 'Faltam páginas', por: 'Clara', em: 'x' });
    expect(recusaLida({ motivo: '' })).toBeNull();
  });
  it('o recibo do cliente leva o motivo, quando tem', () => {
    const base = { id: 'a', nome: 'x.pdf', tipo: 'extrato', tamanho: 1, recebidoEm: '2026-11-01' };
    expect(reciboDoEnvio(base).recusa).toBeUndefined();
    expect(reciboDoEnvio({ ...base, recusa: { motivo: 'É de outro mês', em: '2026-11-02' } }).recusa).toEqual({ motivo: 'É de outro mês', em: '2026-11-02' });
  });
});
