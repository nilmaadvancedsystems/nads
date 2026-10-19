import { describe, expect, it } from 'vitest';
import { abertosPorEmpresa, erroDoFeedback, ordenarFeedbacks, podeEscrever, podeResolver, TEXTO_MAXIMO, type FeedbackDaEmpresa } from './feedbacks';

const f = (x: Partial<FeedbackDaEmpresa>): FeedbackDaEmpresa => ({
  id: 'x', empresa: 'fito', codigo: 292, texto: 'Cliente atrasa o extrato', prioridade: 'media', autorUid: 'u-vitor', autorNome: 'Vitor',
  criadoEm: '2026-10-10T10:00:00.000Z', resolvido: false, resolvidoPor: '', resolvidoEm: '', ...x,
});

describe('quem escreve e quem resolve os feedbacks da empresa', () => {
  it('escrevem o sênior, o diretor e o admin; o pleno e o júnior só leem', () => {
    expect(podeEscrever({ nivel: 'senior', admin: false })).toBe(true);
    expect(podeEscrever({ nivel: 'diretor', admin: false })).toBe(true);
    expect(podeEscrever({ nivel: null, admin: true })).toBe(true);
    expect(podeEscrever({ nivel: 'pleno', admin: false })).toBe(false);
    expect(podeEscrever({ nivel: 'junior', admin: false })).toBe(false);
    expect(podeEscrever({ nivel: null, admin: false })).toBe(false);
    expect(podeEscrever(null)).toBe(false);
  });
  it('resolvem e apagam o autor, o diretor e o admin; outro sênior não', () => {
    const fb = f({ autorUid: 'u-vitor' });
    expect(podeResolver(fb, { uid: 'u-vitor', nivel: 'senior', admin: false })).toBe(true);
    expect(podeResolver(fb, { uid: 'u-fernando', nivel: 'senior', admin: false })).toBe(false);
    expect(podeResolver(fb, { uid: 'u-nilma', nivel: 'diretor', admin: false })).toBe(true);
    expect(podeResolver(fb, { uid: 'u-adm', nivel: 'pleno', admin: true })).toBe(true);
    expect(podeResolver(fb, { uid: 'u-felipe', nivel: 'pleno', admin: false })).toBe(false);
    // sem uid (não entrou), ninguém é o autor
    expect(podeResolver(f({ autorUid: '' }), { uid: '', nivel: 'senior', admin: false })).toBe(false);
    expect(podeResolver(fb, null)).toBe(false);
  });
});

describe('o feedback novo', () => {
  it('pede o texto, respeita o tamanho máximo e a prioridade', () => {
    expect(erroDoFeedback('  ', 'alta')).toBe('Escreva o feedback.');
    expect(erroDoFeedback('x'.repeat(TEXTO_MAXIMO + 1), 'alta')).toMatch(/passa de 1000/);
    expect(erroDoFeedback('  ' + 'x'.repeat(TEXTO_MAXIMO) + '  ', 'alta')).toBeNull();
    expect(erroDoFeedback('Cliente atrasa o extrato', 'urgente')).toBe('Escolha a prioridade.');
    expect(erroDoFeedback('Cliente atrasa o extrato', 'baixa')).toBeNull();
  });
});

describe('a lista', () => {
  it('abertos primeiro, da prioridade alta para a baixa, o mais novo em cima; depois os resolvidos', () => {
    const lista = [
      f({ id: 'resolvido-velho', resolvido: true, resolvidoEm: '2026-10-11T00:00:00.000Z', prioridade: 'alta' }),
      f({ id: 'baixa', prioridade: 'baixa', criadoEm: '2026-10-15T00:00:00.000Z' }),
      f({ id: 'alta-velha', prioridade: 'alta', criadoEm: '2026-10-01T00:00:00.000Z' }),
      f({ id: 'media', prioridade: 'media' }),
      f({ id: 'resolvido-novo', resolvido: true, resolvidoEm: '2026-10-18T00:00:00.000Z' }),
      f({ id: 'alta-nova', prioridade: 'alta', criadoEm: '2026-10-12T00:00:00.000Z' }),
    ];
    expect(ordenarFeedbacks(lista).map(x => x.id)).toEqual(['alta-nova', 'alta-velha', 'media', 'baixa', 'resolvido-novo', 'resolvido-velho']);
  });
  it('conta os abertos e os de prioridade alta de cada empresa (os resolvidos não contam)', () => {
    const m = abertosPorEmpresa([
      f({ empresa: 'fito', prioridade: 'alta' }),
      f({ empresa: 'fito', prioridade: 'baixa' }),
      f({ empresa: 'fito', prioridade: 'alta', resolvido: true }),
      f({ empresa: 'a7', prioridade: 'media' }),
      f({ empresa: 'zeta', prioridade: 'alta', resolvido: true }),
    ]);
    expect(m.get('fito')).toEqual({ abertos: 2, altas: 1 });
    expect(m.get('a7')).toEqual({ abertos: 1, altas: 0 });
    expect(m.has('zeta')).toBe(false);
  });
});
