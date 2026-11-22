import { describe, expect, it } from 'vitest';
import { alertaNaoFuiEu, textoDoAlertaNaoFuiEu, textoDoAvisoDeAcesso } from './liberacao';

describe('o aviso de acesso novo e o "Não fui eu" (E21)', () => {
  it('o aviso fala do computador, do dia e da hora', () => {
    const t = textoDoAvisoDeAcesso({ computador: 'Windows · Chrome', liberadoEm: '2026-11-22T15:30:00.000Z' });
    expect(t.corpo).toContain('Windows · Chrome');
    expect(t.corpo).toContain('22/11/2026 às 12:30');
    expect(t.corpo).toContain('Não fui eu');
  });
  it('o alerta leva quem, a sessão e o computador', () => {
    const a = alertaNaoFuiEu({ id: 'u1_123', uid: 'u1', nome: 'Clara', computador: 'Celular' }, new Date('2026-11-22T12:00:00Z'));
    expect(a).toEqual({ tipo: 'nao-fui-eu', uid: 'u1', nome: 'Clara', sessao: 'u1_123', computador: 'Celular', em: '2026-11-22T12:00:00.000Z' });
    expect(textoDoAlertaNaoFuiEu(a).corpo).toContain('Clara disse "Não fui eu"');
  });
});
