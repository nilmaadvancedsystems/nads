import { describe, expect, it } from 'vitest';
import tabelasJson from './tabelas.json';
import {
  ALIQUOTAS_PADRAO, aliquotasDeReferencia, atividadesDoSimples, buscarClassificacoes, classificacao, cstsVigentes, simularDentroOuFora,
  textoDaReducao, textoDoCredito, type TabelasRtc,
} from './index';

const T = tabelasJson as unknown as TabelasRtc;
const HOJE = '2026-11-22';

describe('as tabelas oficiais (do banco da calculadora da Receita)', () => {
  it('têm os CST do IBS/CBS e as 202 classificações, com a fonte', () => {
    expect(T.fonte).toMatch(/calculadora-rtc-regime-regular/);
    expect(cstsVigentes(T, HOJE).map(c => c.codigo)).toEqual(expect.arrayContaining(['000', '200', '410', '620']));
    expect(new Set(cstsVigentes(T, HOJE).map(c => c.codigo)).size).toBe(cstsVigentes(T, HOJE).length);
    expect(T.cClassTrib.length).toBeGreaterThan(150);
  });

  it('a classificação pelo código: a cesta básica com 100% de redução e sem crédito ao adquirente', () => {
    const c = classificacao(T, '200003', HOJE)!;
    expect(c).toMatchObject({ cst: '200', nomenclatura: 'NCM', reducao: { CBS: 100, IBSUF: 100, IBSMun: 100 } });
    expect(textoDaReducao(c)).toBe('100% na CBS e no IBS');
    expect(textoDoCredito(c)).toBe('não gera crédito ao adquirente');
    expect(textoDaReducao(classificacao(T, '000001', HOJE)!)).toBe('sem redução');
    expect(classificacao(T, '999999', HOJE)).toBeNull();
  });

  it('a busca: pelo começo do código, por palavras sem acento e pelo CST', () => {
    expect(buscarClassificacoes(T, '2000', HOJE).every(c => c.codigo.startsWith('2000'))).toBe(true);
    const alimentos = buscarClassificacoes(T, 'alimentacao humana', HOJE);
    expect(alimentos.map(c => c.codigo)).toContain('200003');
    expect(buscarClassificacoes(T, '', HOJE, '410').every(c => c.cst === '410')).toBe(true);
    expect(buscarClassificacoes(T, 'xyzw nada', HOJE)).toEqual([]);
  });

  it('as alíquotas de referência de 2026 e nenhuma para 2027 (a partir daí, informadas)', () => {
    expect(aliquotasDeReferencia(T, '2026-06-01')).toEqual({ CBS: 0.9, IBSUF: 0.1, IBSMun: 0 });
    expect(aliquotasDeReferencia(T, '2027-02-01')).toBeNull();
  });

  it('as atividades do Simples valem a partir de 2027', () => {
    expect(atividadesDoSimples(T, HOJE)).toEqual([]);
    expect(atividadesDoSimples(T, '2027-01-01')[0]).toMatchObject({ codigo: '01', anexo: 'I' });
  });
});

describe('o simulador do Simples: dentro ou fora do DAS', () => {
  const base = { receita: 100000, das: 10000, pisCofinsNoDas: 1500, comprasComCredito: 60000, aliquotaCbs: ALIQUOTAS_PADRAO.cbs, aliquotaIbs: ALIQUOTAS_PADRAO.ibs };

  it('a conta dos dois lados', () => {
    const r = simularDentroOuFora({ ...base, parteParaContribuintes: 80 });
    expect(r.dentro).toEqual({ imposto: 10000, das: 10000, cbsIbsFora: 0, creditoDosClientes: 1200 });
    // fora: 8,9% de 100.000 = 8.900, menos 8,9% de 60.000 = 5.340 → 3.560; o DAS sem os 1.500 → 8.500
    expect(r.fora).toEqual({ imposto: 12060, das: 8500, cbsIbsFora: 3560, cbsIbsBruto: 8900, creditoDasCompras: 5340, creditoDosClientes: 7120 });
    expect([r.custoAMaisFora, r.creditoAMaisFora]).toEqual([2060, 5920]);
    expect(r.sugestao).toBe('fora');
    expect(r.texto).toMatch(/paga R\$ 2\.060,00 a mais.*ganham R\$ 5\.920,00 a mais de crédito/);
  });

  it('venda quase toda ao consumidor final: dentro do DAS', () => {
    const r = simularDentroOuFora({ ...base, parteParaContribuintes: 10 });
    expect(r.sugestao).toBe('dentro');
    expect(r.texto).toMatch(/consumidor final/);
  });

  it('pouca compra com crédito e venda a contribuintes, mas o custo a mais passa do crédito: dentro', () => {
    const r = simularDentroOuFora({ ...base, comprasComCredito: 0, parteParaContribuintes: 50 });
    expect(r.custoAMaisFora).toBe(7400);
    expect(r.creditoAMaisFora).toBe(3700);
    expect(r.sugestao).toBe('dentro');
  });

  it('fora custando menos (muita compra com crédito): fora; sem receita: tanto faz; valores fora da faixa são cortados', () => {
    expect(simularDentroOuFora({ ...base, comprasComCredito: 95000, parteParaContribuintes: 0 }).sugestao).toBe('fora');
    expect(simularDentroOuFora({ ...base, receita: 0, parteParaContribuintes: 50 }).sugestao).toBe('tanto-faz');
    const r = simularDentroOuFora({ ...base, parteParaContribuintes: 150, pisCofinsNoDas: 99999 });
    expect(r.dentro.creditoDosClientes).toBe(10000);
    expect(r.fora.das).toBe(0);
  });
});
