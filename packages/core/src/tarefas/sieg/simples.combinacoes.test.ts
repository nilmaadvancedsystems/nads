// Testes combinatórios do Simples Nacional (faixas, repartição, teto do ISS, Fator R e prévia do DAS) e do rateio de frete.
// Laços determinísticos e dados inventados, sem cliente real.
import { describe, expect, it } from 'vitest';
import { calculoDoSimples, fatorR, percentuaisEfetivos, type ParcelaDoCalculo } from './calculadora';
import { repartir, ratear } from './rateio';
import { ANEXOS, aliquotaEfetiva, avisoDeLimite, previaDoDas, temIcmsSt, type Anexo } from './simples';

const TODOS: Anexo[] = ['I', 'II', 'III', 'IV', 'V'];
const cent = (n: number) => Math.round(n * 100) / 100;
/** os RBT12 de cada faixa: as pontas e o meio, mais o começo de atividade */
const RBT12: number[] = [0, 0.01, 1000, 179999.99, 180000, 180000.01, 270000, 360000, 360000.01, 720000, 720000.01, 1800000, 1800000.01, 2500000, 3000000, 3600000, 3600000.01, 4200000, 4800000];

describe('as tabelas da LC 123', () => {
  it('a repartição de cada faixa soma 100%', () => {
    for (const a of TODOS) for (const f of ANEXOS[a].faixas) {
      expect([a, f.ate, cent(Object.values(f.reparte).reduce((s, v) => s + (v || 0), 0))]).toEqual([a, f.ate, 100]);
    }
  });

  it('a efetiva fica entre zero e a nominal e não cai de uma faixa para a outra até o sublimite', () => {
    for (const a of TODOS) {
      let antes = 0;
      // na 6ª faixa a efetiva cai de propósito: o ICMS e o ISS saem do DAS (a tabela da LC 123)
      for (const r of RBT12.filter(x => x > 0 && x <= 3600000)) {
        const x = aliquotaEfetiva(a, r);
        expect(x.efetiva).toBeGreaterThan(0);
        expect(x.efetiva).toBeLessThanOrEqual(x.nominal);
        expect(x.efetiva + 0.0001).toBeGreaterThanOrEqual(antes);
        antes = x.efetiva;
      }
    }
  });

  it('a faixa muda no centavo seguinte ao limite', () => {
    for (const a of TODOS) ANEXOS[a].faixas.slice(0, -1).forEach((f, i) => {
      expect(aliquotaEfetiva(a, f.ate).faixa).toBe(i + 1);
      expect(aliquotaEfetiva(a, cent(f.ate + 0.01)).faixa).toBe(i + 2);
      expect(percentuaisEfetivos(a, f.ate).faixa).toBe(i + 1);
      expect(percentuaisEfetivos(a, cent(f.ate + 0.01)).faixa).toBe(i + 2);
    });
  });

  it('RBT12 zero (começo de atividade) usa a nominal da primeira faixa; acima do teto, a última', () => {
    for (const a of TODOS) {
      expect(aliquotaEfetiva(a, 0)).toMatchObject({ faixa: 1, efetiva: ANEXOS[a].faixas[0].aliquota });
      expect(aliquotaEfetiva(a, 9000000).faixa).toBe(6);
      expect(percentuaisEfetivos(a, 9000000).faixa).toBe(6);
    }
  });

  it('as duas contas da alíquota efetiva concordam', () => {
    for (const a of TODOS) for (const r of RBT12) {
      expect(Math.abs(aliquotaEfetiva(a, r).efetiva - percentuaisEfetivos(a, r).efetiva)).toBeLessThanOrEqual(0.0051);
    }
  });

  it('os percentuais de cada tributo somam a efetiva', () => {
    for (const a of TODOS) for (const r of RBT12) {
      const p = percentuaisEfetivos(a, r);
      expect([a, r, cent(p.tributos.reduce((s, t) => s + t.pct, 0))]).toEqual([a, r, p.efetiva]);
    }
  });

  it('o ISS nunca passa de 5% nos Anexos III e IV, e o teto só entra na 5ª faixa', () => {
    for (const a of ['III', 'IV'] as Anexo[]) for (const r of RBT12) {
      const p = percentuaisEfetivos(a, r);
      expect(p.tributos.find(t => t.tributo === 'ISS')?.pct ?? 0).toBeLessThanOrEqual(5);
      if (p.issNoTeto) expect(p.faixa).toBe(5);
    }
  });
});

describe('a prévia do DAS', () => {
  it('sem segregação não há economia, nem de um centavo', () => {
    for (let s = 1; s <= 300; s++) {
      const parcelas = TODOS.map((anexo, i) => ({ rotulo: anexo, anexo, valor: cent((s * 7.77 + i * 3.33) % 9999 + 0.01) }));
      const p = previaDoDas(250000 + s * 991, parcelas);
      expect([s, p.economia]).toEqual([s, 0]);
    }
  });

  it('o total é a soma das parcelas', () => {
    const p = previaDoDas(500000, [{ rotulo: 'a', anexo: 'I', valor: 1000.11 }, { rotulo: 'b', anexo: 'III', valor: 2000.22, semIss: true }, { rotulo: 'c', anexo: 'I', valor: 0 }]);
    expect(p.parcelas).toHaveLength(2);
    expect(p.total).toBe(cent(p.parcelas.reduce((t, l) => t + l.das, 0)));
  });

  it('o ISS retido na 5ª faixa tira só os 5% do teto, como a calculadora', () => {
    for (const anexo of ['III', 'IV'] as Anexo[]) for (const rbt12 of [2500000, 3000000, 3600000]) {
      const a = aliquotaEfetiva(anexo, rbt12);
      if (a.efetiva * (a.reparte.ISS || 0) / 100 <= 5) continue;
      const previa = previaDoDas(rbt12, [{ rotulo: 'x', anexo, valor: 100000, semIss: true }]);
      expect(previa.parcelas[0].aplicada).toBeCloseTo(a.efetiva - 5, 3);
      const calc = calculoDoSimples(rbt12, [{ id: 'x', rotulo: 'x', anexo, valor: 100000, fora: ['ISS'] }]);
      expect(Math.abs(previa.total - calc.total)).toBeLessThanOrEqual(10);
    }
  });

  it('abaixo do teto o ISS retido sai inteiro', () => {
    const a = aliquotaEfetiva('III', 200000);
    expect(previaDoDas(200000, [{ rotulo: 'x', anexo: 'III', valor: 1000, semIss: true }]).parcelas[0].aplicada).toBeCloseTo(a.efetiva * (1 - 32 / 100), 3);
  });

  it('a prévia e a calculadora dão o mesmo DAS (até a diferença de arredondamento da planilha)', () => {
    for (const a of TODOS) for (const r of RBT12.filter(x => x > 0)) {
      const valor = 10000;
      const ef = aliquotaEfetiva(a, r).efetiva;
      // a planilha arredonda a alíquota em 2 casas: até 0,005 ponto percentual por tributo
      expect(Math.abs(previaDoDas(r, [{ rotulo: 'x', anexo: a, valor }]).total - calculoDoSimples(r, [{ id: 'x', rotulo: 'x', anexo: a, valor, fora: [] }]).total)).toBeLessThanOrEqual(valor * 0.0005 + ef * 0);
    }
  });
});

describe('a calculadora do Simples', () => {
  const parcelas = (v: number): ParcelaDoCalculo[] => [
    { id: 'n', rotulo: 'n', anexo: 'I', valor: v, fora: [] },
    { id: 's', rotulo: 's', anexo: 'I', valor: v, fora: ['ICMS'] },
    { id: 'm', rotulo: 'm', anexo: 'I', valor: v, fora: ['PIS', 'COFINS'] },
    { id: 'r', rotulo: 'r', anexo: 'III', valor: v, fora: ['ISS'] },
  ];

  it('a soma dos tributos é o total, em centavos exatos, de 0,01 a milhões', () => {
    for (const v of [0.01, 0.29, 19.99, 1234.56, 99999.99, 1000000.01]) for (const r of RBT12) {
      const c = calculoDoSimples(r, parcelas(v));
      expect(c.total).toBe(cent(c.porTributo.reduce((s, t) => s + t.valor, 0)));
      expect(c.receita).toBe(cent(v * 4));
      expect(c.deduzido).toBeGreaterThanOrEqual(0);
      expect(c.total).toBe(cent(c.total));
    }
  });

  it('parcela zerada não entra', () => {
    expect(calculoDoSimples(100000, [{ id: 'z', rotulo: 'z', anexo: 'I', valor: 0, fora: [] }])).toMatchObject({ receita: 0, total: 0, parcelas: [] });
  });
});

describe('o Fator R', () => {
  const mes = (salario: number) => [{ salario, fgts: 0, cpp: 0 }];
  it.each([
    [28000, 100000, 28, 'III'],
    [27999.99, 100000, 27.99, 'V'],
    [27996, 100000, 27.99, 'V'],
    [28000.01, 100000, 28, 'III'],
    [0, 100000, 0, 'V'],
  ])('folha %d ÷ RBT12 %d → %d%% (%s)', (s, r, f, anexo) => expect(fatorR(mes(s), r)).toMatchObject({ fator: f, anexo }));
  it('RBT12 zero: não dá para calcular', () => expect(fatorR(mes(100), 0)).toMatchObject({ fator: null, anexo: null, folha: 100 }));
  it('a folha é a soma de salário, FGTS e CPP, sem erro de centavo', () => {
    const f = fatorR(Array.from({ length: 12 }, () => ({ salario: 0.1, fgts: 0.2, cpp: 0.1 })), 1000);
    expect(f).toMatchObject({ salario: 1.2, fgts: 2.4, cpp: 1.2, folha: 4.8 });
  });
});

describe('o aviso de limite', () => {
  it.each([
    ['Simples', 4799999.99, 'atencao'], ['Simples', 4800000.01, 'passou'], ['MEI', 72899, null], ['MEI', 72900, 'atencao'], ['MEI', 81000, 'atencao'], ['MEI', 81000.01, 'passou'],
  ])('%s %d → %s', (regime, r, nivel) => expect(avisoDeLimite(regime, r)?.nivel ?? null).toBe(nivel));
  it('sem receita, sem aviso', () => expect(avisoDeLimite('Simples', 0)).toBeNull());
});

describe('o ICMS-ST do item', () => {
  it.each([['5401'], ['5402'], ['5403'], ['6404'], ['5405'], ['6401']])('o CFOP de saída com ST %s tem ST em qualquer CST', cfop => expect(temIcmsSt('000', cfop)).toBe(true));
  it.each([['060', '5102'], ['500', '5102'], ['0500', '5102'], ['010', '5102'], ['070', '5102']])('CST/CSOSN %s tem ST', (c, cfop) => expect(temIcmsSt(c, cfop)).toBe(true));
  it.each([['000', '5102'], ['102', '5102'], ['0102', '5102'], ['040', '5102'], ['', '5102']])('CST/CSOSN %s não tem', (c, cfop) => expect(temIcmsSt(c, cfop)).toBe(false));
});

describe('o rateio', () => {
  it('reparte em centavos: a soma é o total, de 0,01 a milhões', () => {
    for (let s = 1; s <= 300; s++) {
      const pesos = Array.from({ length: (s % 7) + 1 }, (_, i) => ((s * (i + 3)) % 97) / 3);
      const total = cent([0.01, 0.07, 10, 1234.56, 9876543.21][s % 5]);
      const r = repartir(total, pesos);
      if (pesos.some(p => p > 0)) expect(cent(r.reduce((t, x) => t + x, 0))).toBe(total);
      else expect(r.every(x => x === 0)).toBe(true);
    }
  });

  it('o frete e o desconto fecham com a nota; o que está fora da lista fica com a parte dele', () => {
    const r = ratear({ total: 1000, frete: 100.01, desconto: 33.33, linhas: [{ rotulo: 'a', valor: 333.33 }, { rotulo: 'b', valor: 333.33, ipi: 3.33 }] });
    expect(r.soma.valor).toBe(666.66);
    expect(r.foraDaLista?.valor).toBe(333.34);
    expect(cent(r.soma.frete + (r.foraDaLista?.frete || 0))).toBe(100.01);
    expect(cent(r.soma.desconto + (r.foraDaLista?.desconto || 0))).toBe(33.33);
    expect(r.soma.base).toBe(cent(r.soma.valor + r.soma.ipi + r.soma.frete - r.soma.desconto));
  });
});
