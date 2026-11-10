// 2ª rodada: valores. Limites exatos das faixas do Simples, arredondamento de meio centavo (o ARRED da planilha) na prévia do
// DAS, no Lucro Presumido/Real e na antecipação do ICMS; centavos em somas longas. Dados fictícios; semente fixa.
import { vi, describe, expect, it } from 'vitest';
import { arred, contaDaAntecipacao } from './antecipacao';
import { fatorR, calculoDoSimples } from './calculadora';
import { irpjCsll, mesesDoTrimestre, pisCofins, type ReceitasDoMes } from './lucro';
import { repartir, ratear } from './rateio';
import { ANEXOS, aliquotaEfetiva, avisoDeLimite, LIMITE_MEI, previaDoDas, SUBLIMITE, TETO, type Anexo } from './simples';

// laços com milhares de combinações: com a suíte inteira rodando, os 5 s de sempre não bastam
vi.setConfig({ testTimeout: 60000 });

function gerador(semente: number) {
  let a = semente >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** o valor certo: centavos × taxa (em centésimos de %), meio centavo para cima, só com inteiros */
function exato(cent: number, milesimos: number, divisor: number): number {
  const q = Math.floor((2 * cent * milesimos + divisor) / (2 * divisor));
  return q / 100;
}

const ANEXOS_TODOS = Object.keys(ANEXOS) as Anexo[];

describe('as faixas do Simples, nos limites exatos', () => {
  it.each(ANEXOS_TODOS)('Anexo %s: o limite da faixa fica nela e um centavo a mais passa para a próxima', anexo => {
    const fs = ANEXOS[anexo].faixas;
    fs.forEach((f, i) => {
      expect(aliquotaEfetiva(anexo, f.ate).faixa).toBe(i + 1);
      if (i < fs.length - 1) expect(aliquotaEfetiva(anexo, f.ate + 0.01).faixa).toBe(i + 2);
    });
  });
  // da 5ª para a 6ª a efetiva cai de verdade (a parcela a deduzir da LC 123 é assim): só até a 5ª
  it.each(ANEXOS_TODOS)('Anexo %s: a efetiva não dá salto para baixo ao mudar de faixa, até a 5ª', anexo => {
    const fs = ANEXOS[anexo].faixas;
    for (let i = 0; i < fs.length - 2; i++) {
      const antes = aliquotaEfetiva(anexo, fs[i].ate).efetiva, depois = aliquotaEfetiva(anexo, fs[i].ate + 0.01).efetiva;
      expect(depois).toBeGreaterThanOrEqual(antes - 0.0001);
    }
  });
  it('RBT12 zero, acima do teto e a efetiva nunca é maior que a nominal', () => {
    expect(aliquotaEfetiva('I', 0)).toMatchObject({ faixa: 1, efetiva: 4, nominal: 4 });
    expect(aliquotaEfetiva('I', 4800000.01).faixa).toBe(6);
    const r = gerador(123);
    for (let i = 0; i < 2000; i++) {
      const an = ANEXOS_TODOS[Math.floor(r() * ANEXOS_TODOS.length)];
      const a = aliquotaEfetiva(an, Math.floor(r() * 480000000) / 100 + 0.01);
      expect(a.efetiva).toBeLessThanOrEqual(a.nominal + 0.0001);
      expect(a.efetiva).toBeGreaterThan(0);
    }
  });
  it('os avisos nos limites exatos (90% e o limite)', () => {
    expect(avisoDeLimite('Simples', SUBLIMITE * 0.9 - 0.01)).toBeNull();
    expect(avisoDeLimite('Simples', 3240000)?.nivel).toBe('atencao');
    expect(avisoDeLimite('Simples', SUBLIMITE)?.nivel).toBe('atencao');
    expect(avisoDeLimite('Simples', SUBLIMITE + 0.01)?.nivel).toBe('passou');
    expect(avisoDeLimite('Simples', 4320000)?.nivel).toBe('atencao');
    expect(avisoDeLimite('Simples', TETO)?.nivel).toBe('atencao');
    expect(avisoDeLimite('Simples', TETO + 0.01)?.nivel).toBe('passou');
    expect(avisoDeLimite('MEI', 72900)?.nivel).toBe('atencao');
    expect(avisoDeLimite('MEI', 72899.99)).toBeNull();
    expect(avisoDeLimite('MEI', LIMITE_MEI)?.nivel).toBe('atencao');
    expect(avisoDeLimite('MEI', LIMITE_MEI + 0.01)?.nivel).toBe('passou');
    expect(avisoDeLimite('Presumido', 9e9)).toBeNull();
    expect(avisoDeLimite('Simples', 0)).toBeNull();
  });
  it('Fator R nos 28% exatos e um pouco abaixo', () => {
    const folha = (v: number) => Array.from({ length: 12 }, (_, i) => ({ competencia: '2026-' + String(i + 1).padStart(2, '0'), salario: v / 12, fgts: 0, cpp: 0 }));
    expect(fatorR(folha(28000) as never, 100000).anexo).toBe('III');
    expect(fatorR(folha(27996) as never, 100000).anexo).toBe('V');
  });
});

describe('o meio centavo arredonda para cima (o ARRED da planilha, sem o erro do ponto flutuante)', () => {
  const receitas = (mercadorias: number, servicos = 0): ReceitasDoMes => ({ mercadorias, devolucoes: 0, semPisCofins: 0, icmsDestacado: 0, servicos, retidos: { irrf: 0, csll: 0, pis: 0, cofins: 0 } });

  it('IRPJ de 15% sobre a base que dá meio centavo', () => {
    // 100,10 × 15% = 15,015 → 15,02
    const r = irpjCsll([{ competencia: '2026-03', mercadorias: 0, servicos: 0, irrf: 0, csll: 0 }], { mercadorias: 'comercio', servicos: 'servicos' }, 100.1);
    expect(r.base.irpj).toBe(100.1);
    expect(r.irpj).toBe(15.02);
  });

  it('o IRPJ, a CSLL e o adicional batem com a conta em inteiros, em 20.000 bases sorteadas', () => {
    const r = gerador(1510);
    for (let i = 0; i < 20000; i++) {
      const c = Math.floor(r() * 10_000_000) + 1;
      const x = irpjCsll([{ competencia: '2026-01', mercadorias: 0, servicos: 0, irrf: 0, csll: 0 }], { mercadorias: 'comercio', servicos: 'servicos' }, c / 100);
      expect(x.irpj, 'irpj ' + c).toBe(exato(c, 15, 100));
      expect(x.csll, 'csll ' + c).toBe(exato(c, 9, 100));
      expect(x.adicional, 'adicional ' + c).toBe(exato(Math.max(0, c - 2_000_000), 10, 100));
    }
  });

  it('PIS e COFINS batem com a conta em inteiros, em 20.000 bases sorteadas', () => {
    const r = gerador(765);
    for (let i = 0; i < 20000; i++) {
      const c = Math.floor(r() * 10_000_000) + 1;
      const p = pisCofins('Presumido', receitas(c / 100));
      expect(p.debito.pis, 'pis ' + c).toBe(exato(c, 65, 10000));
      expect(p.debito.cofins, 'cofins ' + c).toBe(exato(c, 3, 100));
      const q = pisCofins('Real', receitas(c / 100));
      expect(q.debito.pis, 'pis real ' + c).toBe(exato(c, 165, 10000));
      expect(q.debito.cofins, 'cofins real ' + c).toBe(exato(c, 76, 1000));
    }
  });

  it('a antecipação do ICMS já arredonda certo no meio centavo e com negativo', () => {
    expect(arred(1.005)).toBe(1.01);
    expect(arred(-1.005)).toBe(-1.01);
    expect(contaDaAntecipacao(100.1, 0, 15)).toMatchObject({ icmsInterno: 15.02 });
  });

  it('a calculadora do Simples: cada tributo bate com a conta em inteiros, em 20.000 receitas sorteadas e nos meios centavos', () => {
    const r = gerador(2018);
    // 118,75 × 0,24% = 0,285 e 2.150,00 × 0,21% = 4,515 caíam para baixo
    const receitas = [11875, 215000, ...Array.from({ length: 20000 }, () => Math.floor(r() * 5_000_000) + 1)];
    for (const c of receitas) {
      const x = calculoDoSimples(0, [{ id: 'p', rotulo: 'x', anexo: 'III', valor: c / 100, fora: [] }] as never);
      const valores = x.parcelas[0].valores as Record<string, number>;
      for (const t of x.percentuais[0].tributos) expect(valores[t.tributo], t.tributo + ' ' + c).toBe(exato(c, Math.round(t.pct * 100), 10000));
    }
  });

  it('a prévia do DAS bate com a conta em inteiros na 1ª faixa (a efetiva é a nominal: 4%, 6% e 4,5%)', () => {
    const r = gerador(404);
    for (let i = 0; i < 20000; i++) {
      const c = Math.floor(r() * 5_000_000) + 1;
      expect(previaDoDas(0, [{ rotulo: 'x', anexo: 'I', valor: c / 100 }]).total, 'I ' + c).toBe(exato(c, 4, 100));
      expect(previaDoDas(0, [{ rotulo: 'x', anexo: 'III', valor: c / 100 }]).total, 'III ' + c).toBe(exato(c, 6, 100));
      expect(previaDoDas(0, [{ rotulo: 'x', anexo: 'IV', valor: c / 100 }]).total, 'IV ' + c).toBe(exato(c, 45, 1000));
    }
  });
});

describe('o Lucro e o trimestre', () => {
  it('os meses do trimestre só fecham em março, junho, setembro e dezembro', () => {
    expect(mesesDoTrimestre('2026-12')).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(mesesDoTrimestre('2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
    for (const c of ['2026-01', '2026-02', '2026-11', '2026-13', 'x']) expect(mesesDoTrimestre(c)).toEqual([]);
  });
  it('o adicional do trimestre no limite exato de R$ 60 mil de base', () => {
    const mes = (competencia: string, servicos: number) => ({ competencia, mercadorias: 0, servicos, irrf: 0, csll: 0 });
    const a = { mercadorias: 'comercio', servicos: 'servicos' } as const;
    // 187.500 × 32% = 60.000
    expect(irpjCsll([mes('2026-01', 62500), mes('2026-02', 62500), mes('2026-03', 62500)], a).adicional).toBe(0);
    expect(irpjCsll([mes('2026-01', 62500), mes('2026-02', 62500), mes('2026-03', 62501)], a).adicional).toBe(0.03);
  });
  it('sem nenhum mês: nada a pagar', () => {
    const r = irpjCsll([], { mercadorias: 'comercio', servicos: 'servicos' });
    expect(r).toMatchObject({ irpj: 0, csll: 0, adicional: 0, aPagar: { irpj: 0, csll: 0 } });
  });
  it('o retido maior que o imposto não deixa valor negativo', () => {
    const r = irpjCsll([{ competencia: '2026-03', mercadorias: 0, servicos: 1000, irrf: 500, csll: 500 }], { mercadorias: 'comercio', servicos: 'servicos' });
    expect(r.aPagar).toEqual({ irpj: 0, csll: 0 });
  });
});

describe('o rateio em centavos', () => {
  it('a soma das partes é o total, em 5.000 sorteios', () => {
    const r = gerador(99);
    for (let i = 0; i < 5000; i++) {
      const c = Math.floor(r() * 10_000_000) + 1;
      const pesos = Array.from({ length: 1 + Math.floor(r() * 12) }, () => Math.floor(r() * 500000) / 100);
      const partes = repartir(c / 100, pesos);
      if (pesos.reduce((s, x) => s + x, 0) <= 0) continue;
      expect(partes.reduce((s, x) => s + Math.round(x * 100), 0)).toBe(c);
    }
  });
  it('o total maior que as linhas guarda a parte de fora e a base fecha', () => {
    const x = ratear({ total: 1000, frete: 100.01, desconto: 10.01, linhas: [{ rotulo: 'A', valor: 300 }, { rotulo: 'B', valor: 200, ipi: 5.5 }] });
    expect(x.foraDaLista?.valor).toBe(500);
    expect(Math.round((x.soma.frete + (x.foraDaLista?.frete || 0)) * 100)).toBe(10001);
    expect(Math.round((x.soma.desconto + (x.foraDaLista?.desconto || 0)) * 100)).toBe(1001);
  });
});

describe('o cálculo do Simples por tributo', () => {
  it('a soma dos tributos de cada parcela é o DAS da parcela e o total soma as parcelas', () => {
    const r = gerador(7);
    for (let i = 0; i < 2000; i++) {
      const anexo = ANEXOS_TODOS[Math.floor(r() * ANEXOS_TODOS.length)];
      const x = calculoDoSimples(Math.floor(r() * 300000000) / 100 + 1, [{ id: 'p1', rotulo: 'x', anexo, valor: Math.floor(r() * 10000000) / 100 + 1, fora: [] }] as never);
      const l = x.parcelas[0];
      const soma = Object.values(l.valores as Record<string, number>).reduce((s, n) => s + Math.round((n || 0) * 100), 0);
      expect(soma).toBe(Math.round(l.das * 100));
    }
  });
});
