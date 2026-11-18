// O e-mail quando o escritório responde (plano do Acessórias, 17/11/2026, ficha aviso-de-resposta, parte B).
import { describe, expect, it } from 'vitest';
import { emailDoAviso, precisaAvisar } from './avisoDeResposta';

const AGORA = new Date('2026-11-18T12:00:00.000Z');
const msg = (de: string, em: string, interna = false) => ({ de, em, ...(interna ? { interna } : {}) });

describe('quando avisar o cliente', () => {
  it('a resposta da equipe avisa depois de 15 minutos', () => {
    const c = { situacao: 'respondido', mensagens: [msg('cliente', '2026-11-18T10:00:00.000Z'), msg('escritorio', '2026-11-18T11:40:00.000Z')] };
    expect(precisaAvisar(c, AGORA)).toBe('resposta');
    expect(precisaAvisar({ ...c, mensagens: [...c.mensagens.slice(0, 1), msg('escritorio', '2026-11-18T11:50:00.000Z')] }, AGORA)).toBeNull();
  });
  it('respostas seguidas: um aviso só, depois da última', () => {
    const c = { situacao: 'respondido', mensagens: [msg('escritorio', '2026-11-18T11:00:00.000Z'), msg('escritorio', '2026-11-18T11:55:00.000Z')] };
    expect(precisaAvisar(c, AGORA)).toBeNull();
    expect(precisaAvisar(c, new Date('2026-11-18T12:10:00.000Z'))).toBe('resposta');
  });
  it('não avisa duas vezes a mesma resposta; avisa a nova', () => {
    const c = { situacao: 'respondido', mensagens: [msg('escritorio', '2026-11-18T11:00:00.000Z')], avisoEnviadoEm: '2026-11-18T11:00:00.000Z' };
    expect(precisaAvisar(c, AGORA)).toBeNull();
    expect(precisaAvisar({ ...c, mensagens: [...c.mensagens, msg('escritorio', '2026-11-18T11:30:00.000Z')] }, AGORA)).toBe('resposta');
  });
  it('a nota interna e a mensagem do cliente não avisam', () => {
    expect(precisaAvisar({ situacao: 'respondido', mensagens: [msg('escritorio', '2026-11-18T11:00:00.000Z', true)] }, AGORA)).toBeNull();
    expect(precisaAvisar({ situacao: 'respondido', mensagens: [msg('escritorio', '2026-11-18T10:00:00.000Z'), msg('cliente', '2026-11-18T11:00:00.000Z')], avisoEnviadoEm: '2026-11-18T10:00:00.000Z' }, AGORA)).toBeNull();
  });
  it('a conclusão avisa uma vez; aberto ou em andamento não', () => {
    expect(precisaAvisar({ situacao: 'concluido', mensagens: [msg('cliente', '2026-11-18T10:00:00.000Z')] }, AGORA)).toBe('conclusao');
    expect(precisaAvisar({ situacao: 'concluido', mensagens: [], avisoConclusaoEm: '2026-11-18T11:00:00.000Z' }, AGORA)).toBeNull();
    expect(precisaAvisar({ situacao: 'em andamento', mensagens: [msg('escritorio', '2026-11-18T10:00:00.000Z')] }, AGORA)).toBeNull();
  });
  it('o e-mail aponta para a Área e não leva a resposta', () => {
    const e = emailDoAviso('Férias do João', 'https://cliente/x', 'resposta');
    expect(e.assunto).toBe('Respondemos o seu pedido: Férias do João');
    expect(e.corpo).toContain('https://cliente/x');
    expect(e.corpo).toContain('a resposta fica na Área do Cliente');
    expect(emailDoAviso('X', 'l', 'conclusao').assunto).toBe('Concluímos o seu pedido: X');
  });
});
