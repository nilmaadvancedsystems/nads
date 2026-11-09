import { describe, expect, it } from 'vitest';
import { podeAtualizarSozinho } from './versaoNova';

const base = { dentroDeEtapa: false, versaoNova: '0.0.2', parada: 10 * 60 * 1000, visivel: true };

describe('atualizar sozinha por inatividade', () => {
  it('aba à vista, versão nova e 10 min parada: atualiza', () => expect(podeAtualizarSozinho(base)).toBe(true));
  it('aba escondida espera a pessoa voltar', () => expect(podeAtualizarSozinho({ ...base, visivel: false })).toBe(false));
  it('com uso recente, sem versão nova ou dentro de uma etapa: não atualiza', () => {
    expect(podeAtualizarSozinho({ ...base, parada: 9 * 60 * 1000 })).toBe(false);
    expect(podeAtualizarSozinho({ ...base, versaoNova: '' })).toBe(false);
    expect(podeAtualizarSozinho({ ...base, dentroDeEtapa: true })).toBe(false);
  });
});
