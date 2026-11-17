// Testes das regras curtas das Guias (16/11/2026: "muita informação").
import { describe, expect, it } from 'vitest';
import { quandoVence, resumoCurtoDasGuias } from './guiasDoMes';

describe('resumoCurtoDasGuias (no máximo dois fatos embaixo do título)', () => {
  const base = { nomeDoMes: 'novembro', aPagar: { valor: 'R$ 2.633,89', guias: 3 }, vencidas: 1, proxima: '19/11', pagas: 1 };
  it('com vencida: o total a pagar e quantas venceram', () => {
    expect(resumoCurtoDasGuias(base)).toEqual([{ valor: 'R$ 2.633,89', depois: 'a pagar' }, { valor: '1 vencida', tom: 'perigo' }]);
    expect(resumoCurtoDasGuias({ ...base, vencidas: 2 })[1]).toEqual({ valor: '2 vencidas', tom: 'perigo' });
  });
  it('sem vencida: o total e o próximo vencimento', () => {
    expect(resumoCurtoDasGuias({ ...base, vencidas: 0 })).toEqual([{ valor: 'R$ 2.633,89', depois: 'a pagar' }, { antes: 'próximo vencimento', valor: '19/11' }]);
    expect(resumoCurtoDasGuias({ ...base, vencidas: 0, proxima: null })).toEqual([{ valor: 'R$ 2.633,89', depois: 'a pagar' }]);
  });
  it('nada a pagar: diz isso e, se houver, quantas foram pagas', () => {
    const nada = { ...base, aPagar: { valor: 'R$ 0,00', guias: 0 }, vencidas: 0, proxima: null };
    expect(resumoCurtoDasGuias(nada)).toEqual([{ valor: 'Nada a pagar', depois: 'em novembro' }, { valor: '1 guia paga' }]);
    expect(resumoCurtoDasGuias({ ...nada, pagas: 3 })[1]).toEqual({ valor: '3 guias pagas' });
    expect(resumoCurtoDasGuias({ ...nada, pagas: 0 })).toEqual([{ valor: 'Nada a pagar', depois: 'em novembro' }]);
  });
  it('nunca passa de dois fatos', () => {
    for (const vencidas of [0, 1, 4]) for (const pagas of [0, 2]) expect(resumoCurtoDasGuias({ ...base, vencidas, pagas }).length).toBeLessThanOrEqual(2);
  });
});

describe('quandoVence (a frase curta de cada guia)', () => {
  it('só a data, sem o "daqui a N dias"', () => {
    expect(quandoVence('a vencer', '19/11/2026')).toEqual({ texto: 'Vence 19/11', tom: '' });
    expect(quandoVence('vencida', '11/11/2026')).toEqual({ texto: 'Venceu 11/11', tom: 'vencida' });
    expect(quandoVence('vence hoje', '16/11/2026')).toEqual({ texto: 'Vence hoje', tom: 'hoje' });
  });
  it('a data que não deu para ler fica na situação', () => {
    expect(quandoVence('a vencer', '')).toEqual({ texto: 'A pagar', tom: '' });
    expect(quandoVence('vencida', '')).toEqual({ texto: 'Vencida', tom: 'vencida' });
  });
});
