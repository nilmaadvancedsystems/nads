import { describe, expect, it } from 'vitest';
import { juntarAvisos, limparAviso, MAIOR_AVISO, ordenarAvisos, porcentagemDe, problemaDoAviso, resumoDoProgresso } from './inicio';

describe('avisos do escritório', () => {
  it('limpa as pontas e as linhas em branco repetidas', () => {
    expect(limparAviso('  Reunião às 9h  \r\n\r\n\r\n\nTraga o notebook.  ')).toBe('Reunião às 9h\n\nTraga o notebook.');
  });
  it('não deixa publicar vazio nem grande demais', () => {
    expect(problemaDoAviso('   \n ')).toBe('Escreva o aviso.');
    expect(problemaDoAviso('x'.repeat(MAIOR_AVISO + 1))).toMatch(/passou/);
    expect(problemaDoAviso('Feriado na sexta')).toBe('');
  });
  it('fixados em cima, depois o mais novo', () => {
    const l = [
      { id: 'a', em: '2026-10-01T10:00:00Z' },
      { id: 'b', em: '2026-10-03T10:00:00Z' },
      { id: 'c', em: '2026-09-01T10:00:00Z', fixado: true },
    ];
    expect(ordenarAvisos(l).map(x => x.id)).toEqual(['c', 'b', 'a']);
  });
  it('o fixado antigo (fora dos mais novos) entra no mural, uma vez só', () => {
    const recentes = [{ id: 'n1', em: '2026-10-29T10:00:00Z', fixado: false }, { id: 'f2', em: '2026-10-28T10:00:00Z', fixado: true }];
    const fixados = [{ id: 'f2', em: '2026-10-28T10:00:00Z', fixado: true }, { id: 'f-velho', em: '2026-01-05T10:00:00Z', fixado: true }];
    expect(ordenarAvisos(juntarAvisos(recentes, fixados)).map(x => x.id)).toEqual(['f2', 'f-velho', 'n1']);
    // desafixado: os mais novos já dizem que não está fixado
    expect(juntarAvisos([{ id: 'f2', em: '', fixado: false }], [{ id: 'f2', em: '', fixado: true }])).toEqual([{ id: 'f2', em: '', fixado: false }]);
  });
});

describe('resumo do progresso', () => {
  it('conta por situação e soma as etapas', () => {
    const r = resumoDoProgresso([
      { situacao: 'concluida', concluidas: 5, total: 5 },
      { situacao: 'parada', concluidas: 2, total: 5 },
      { situacao: 'nao-iniciada', concluidas: 0, total: 5 },
    ]);
    expect(r.empresas).toBe(3);
    expect(r.porSituacao).toEqual({ 'nao-iniciada': 1, 'em-andamento': 0, parada: 1, concluida: 1 });
    expect(r.etapasFeitas).toBe(7);
    expect(r.etapasTotal).toBe(15);
    expect(r.porcentagem).toBe(46);
  });
  it('sem empresas, zero', () => {
    expect(resumoDoProgresso([]).porcentagem).toBe(0);
  });
  it('só chega a 100 com tudo feito', () => {
    expect(porcentagemDe(999, 1000)).toBe(99);
    expect(porcentagemDe(10, 10)).toBe(100);
    expect(porcentagemDe(3, 0)).toBe(0);
  });
});
