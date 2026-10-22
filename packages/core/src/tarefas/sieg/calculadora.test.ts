import { describe, expect, it } from 'vitest';
import { calculoDoSimples, fatorR, PARCELAS_DA_RECEITA, percentuaisEfetivos } from './calculadora';
import type { Anexo } from './simples';

// Os números da própria "PLANILHA SIMPLES NACIONAL 2018.xlsx", recalculada no Excel com cada RBT12 (a alíquota efetiva e
// os percentuais efetivos, em %; nos Anexos III e IV, a linha 24, que já tem o teto de 5% do ISS)
const DA_PLANILHA: [Anexo, number, number, Record<string, number>][] = [
  ['I', 100000, 4.0, { IRPJ: 0.22, CSLL: 0.14, COFINS: 0.51, PIS: 0.11, CPP: 1.66, ICMS: 1.36 }],
  ['I', 500000, 6.73, { IRPJ: 0.37, CSLL: 0.24, COFINS: 0.86, PIS: 0.19, CPP: 2.82, ICMS: 2.25 }],
  ['I', 923315.26, 8.26, { IRPJ: 0.45, CSLL: 0.29, COFINS: 1.05, PIS: 0.23, CPP: 3.47, ICMS: 2.77 }],
  ['I', 2500000, 10.81, { IRPJ: 0.59, CSLL: 0.38, COFINS: 1.38, PIS: 0.3, CPP: 4.54, ICMS: 3.62 }],
  ['I', 4000000, 9.55, { IRPJ: 1.29, CSLL: 0.96, COFINS: 2.7, PIS: 0.59, CPP: 4.01, ICMS: 0 }],
  ['II', 327951.23, 5.99, { IRPJ: 0.33, CSLL: 0.21, COFINS: 0.69, PIS: 0.15, CPP: 2.24, IPI: 0.45, ICMS: 1.92 }],
  ['II', 1000000, 8.95, { IRPJ: 0.49, CSLL: 0.31, COFINS: 1.03, PIS: 0.22, CPP: 3.37, IPI: 0.67, ICMS: 2.86 }],
  ['II', 4200000, 12.86, { IRPJ: 1.09, CSLL: 0.96, COFINS: 2.7, PIS: 0.58, CPP: 3.02, IPI: 4.51, ICMS: 0 }],
  ['III', 180, 6.0, { IRPJ: 0.24, CSLL: 0.21, COFINS: 0.77, PIS: 0.17, CPP: 2.6, ISS: 2.01 }],
  ['III', 250000, 7.46, { IRPJ: 0.3, CSLL: 0.26, COFINS: 1.05, PIS: 0.23, CPP: 3.23, ISS: 2.39 }],
  ['III', 1000000, 12.44, { IRPJ: 0.5, CSLL: 0.44, COFINS: 1.7, PIS: 0.37, CPP: 5.39, ISS: 4.04 }],
  ['III', 2500000, 15.97, { IRPJ: 0.66, CSLL: 0.58, COFINS: 2.12, PIS: 0.45, CPP: 7.16, ISS: 5.0 }],
  ['III', 3400000, 17.31, { IRPJ: 0.74, CSLL: 0.65, COFINS: 2.37, PIS: 0.51, CPP: 8.04, ISS: 5.0 }],
  ['III', 4000000, 16.8, { IRPJ: 5.89, CSLL: 2.52, COFINS: 2.69, PIS: 0.58, CPP: 5.12, ISS: 0 }],
  ['IV', 180000, 4.5, { IRPJ: 0.85, CSLL: 0.68, COFINS: 0.8, PIS: 0.17, ISS: 2.0 }],
  ['IV', 500000, 7.72, { IRPJ: 1.61, CSLL: 1.17, COFINS: 1.52, PIS: 0.33, ISS: 3.09 }],
  ['IV', 3000000, 15.87, { IRPJ: 3.4, CSLL: 3.48, COFINS: 3.28, PIS: 0.71, ISS: 5.0 }],
  ['IV', 4500000, 14.6, { IRPJ: 7.81, CSLL: 3.14, COFINS: 3.0, PIS: 0.65, ISS: 0 }],
  ['V', 180000, 15.5, { IRPJ: 3.88, CSLL: 2.33, COFINS: 2.19, PIS: 0.47, CPP: 4.46, ISS: 2.17 }],
  ['V', 600000, 17.85, { IRPJ: 4.28, CSLL: 2.68, COFINS: 2.66, PIS: 0.58, CPP: 4.26, ISS: 3.39 }],
  ['V', 2000000, 19.9, { IRPJ: 4.58, CSLL: 2.49, COFINS: 2.81, PIS: 0.61, CPP: 4.73, ISS: 4.68 }],
  ['V', 3500000, 21.23, { IRPJ: 4.88, CSLL: 2.65, COFINS: 2.99, PIS: 0.65, CPP: 5.07, ISS: 4.99 }],
];

describe('a calculadora do Simples (a planilha do Fiscal, 22/10/2026)', () => {
  it.each(DA_PLANILHA)('Anexo %s, RBT12 %d: a alíquota efetiva e os percentuais iguais aos da planilha', (anexo, rbt12, efetiva, tributos) => {
    const p = percentuaisEfetivos(anexo, rbt12);
    expect(p.efetiva).toBe(efetiva);
    expect(Object.fromEntries(p.tributos.map(t => [t.tributo, t.pct]))).toEqual(tributos);
    // a soma dos tributos fecha com a alíquota efetiva
    expect(Math.round(p.tributos.reduce((s, t) => s + t.pct, 0) * 100) / 100).toBe(efetiva);
  });

  it('o ISS acima de 5% (Anexo III, 5ª faixa) vai para os federais', () => {
    expect(percentuaisEfetivos('III', 2500000)).toMatchObject({ faixa: 5, issNoTeto: true });
    expect(percentuaisEfetivos('III', 1000000).issNoTeto).toBe(false);
  });

  it('o DAS tributo a tributo, sem o ICMS da ST e sem o PIS/Cofins do monofásico (a aba EFETIVA)', () => {
    const parcela = (id: string, valor: number, anexo: Anexo = 'I') => ({ ...PARCELAS_DA_RECEITA.find(p => p.id === id)!, anexo, valor });
    const c = calculoDoSimples(923315.26, [parcela('normal', 10000), parcela('st', 2000), parcela('monofasico', 1000), parcela('issRetido', 0, 'III')]);
    expect(c.receita).toBe(13000);
    expect(c.parcelas.map(p => [p.id, p.aplicada, p.das])).toEqual([['normal', 8.26, 826], ['st', 5.49, 109.8], ['monofasico', 6.98, 69.8]]);
    expect(c.porTributo.find(t => t.tributo === 'ICMS')).toMatchObject({ valor: 304.7 });
    expect(c.porTributo.find(t => t.tributo === 'PIS')).toMatchObject({ valor: 27.6 });
    expect(c.total).toBe(1005.6);
    expect(c.deduzido).toBe(68.2);
  });

  it('a mercadoria no Anexo I e o serviço no III, cada um com os seus percentuais', () => {
    const c = calculoDoSimples(250000, [
      { id: 'normal', rotulo: 'Mercadorias', anexo: 'I', valor: 1000, fora: [] },
      { id: 'issRetido', rotulo: 'Serviço com ISS retido', anexo: 'III', valor: 1000, fora: ['ISS'] },
    ]);
    expect(c.percentuais.map(p => [p.anexo, p.efetiva])).toEqual([['I', 4.92], ['III', 7.46]]);
    // o serviço: 7,46% − 2,39% do ISS
    expect(c.parcelas.map(p => [p.anexo, p.aplicada, p.das])).toEqual([['I', 4.92, 49.2], ['III', 5.07, 50.7]]);
    expect(c.porTributo.map(t => t.tributo)).toEqual(['IRPJ', 'CSLL', 'COFINS', 'PIS', 'CPP', 'ICMS']);
    expect(c.total).toBe(99.9);
  });

  it('o Fator R: a folha dos 12 meses (salário, FGTS e CPP) sobre o RBT12', () => {
    const meses = Array.from({ length: 12 }, () => ({ salario: 10000, fgts: 800, cpp: 0 }));
    expect(fatorR(meses, 400000)).toMatchObject({ folha: 129600, fator: 32.4, anexo: 'III' });
    expect(fatorR(meses, 500000)).toMatchObject({ fator: 25.92, anexo: 'V' });
    expect(fatorR(meses, 0)).toMatchObject({ fator: null, anexo: null });
  });
});
