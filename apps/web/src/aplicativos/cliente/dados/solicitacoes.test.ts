import { describe, expect, it } from 'vitest';
import { resumoDasSolicitacoes } from './solicitacoes';

describe('resumoDasSolicitacoes (16/11/2026: "muita informação")', () => {
  it('sem solicitação nenhuma: nada embaixo do título', () => {
    expect(resumoDasSolicitacoes({ total: 0, respondidas: 0, abertas: 0 })).toBe('');
  });
  it('no máximo dois fatos, sem o total (já está na aba Todas)', () => {
    expect(resumoDasSolicitacoes({ total: 2, respondidas: 1, abertas: 1 })).toBe('1 respondida esperando você · 1 em andamento');
    expect(resumoDasSolicitacoes({ total: 5, respondidas: 2, abertas: 3 })).toBe('2 respondidas esperando você · 3 em andamento');
  });
  it('só um dos dois quando o outro é zero', () => {
    expect(resumoDasSolicitacoes({ total: 3, respondidas: 0, abertas: 2 })).toBe('2 em andamento');
    expect(resumoDasSolicitacoes({ total: 3, respondidas: 1, abertas: 0 })).toBe('1 respondida esperando você');
  });
  it('tudo concluído: "Nada pendente"', () => {
    expect(resumoDasSolicitacoes({ total: 4, respondidas: 0, abertas: 0 })).toBe('Nada pendente');
  });
});
