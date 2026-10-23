import { describe, expect, it } from 'vitest';
import { competenciasDoPeriodo, faturamentoDasSaidas, linhasDoFaturamento, mesesDoDetalhe, planilhaDoFaturamento, resumoDasEmitidas, type NotasSieg, type SaidasSieg } from '.';

const saida = (codigo: string, competencia: string, ...valores: number[]): SaidasSieg => ({ codigo, competencia, em: '', series: valores.map((valor, i) => ({ modelo: '55', serie: String(i + 1), numeros: [], canceladas: [], valor })) });

describe('o faturamento dos clientes (Heverton, 20/10/2026)', () => {
  it('as competências do período', () => {
    expect(competenciasDoPeriodo('mes', '2026-09')).toEqual(['2026-09']);
    expect(competenciasDoPeriodo('ano', '2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(competenciasDoPeriodo('12m', '2026-09')).toEqual(['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(competenciasDoPeriodo('mes', 'x')).toEqual([]);
  });
  it('soma as séries do SIEG; sem o mês, vazio (nada inventado)', () => {
    expect(faturamentoDasSaidas(saida('1', '2026-09', 100.1, 200.2))).toBe(300.3);
    expect(faturamentoDasSaidas(null)).toBeNull();
  });
  it('as linhas: o total, a variação contra o mês anterior e a fonte', () => {
    const meses = new Map([['2026-08', new Map([['10', saida('10', '2026-08', 1000)]])], ['2026-09', new Map([['10', saida('10', '2026-09', 1500)], ['20', saida('20', '2026-09', 50)]])]]);
    const doMes = (c: string) => meses.get(c) || new Map();
    const l = linhasDoFaturamento([{ codigo: 10, nome: 'A', regime: 'Simples' }, { codigo: 20, nome: 'B', regime: 'MEI' }, { codigo: 30, nome: 'C', regime: 'Real' }], ['2026-08', '2026-09'], doMes);
    expect(l.map(x => x.codigo)).toEqual([10, 20, 30]);
    expect(l[0]).toMatchObject({ total: 2500, variacao: 50, fontes: ['SIEG · NF-e/NFC-e emitidas'] });
    expect(l[1]).toMatchObject({ total: 50, variacao: null });
    expect(l[2]).toMatchObject({ total: null, variacao: null, fontes: [] });
    expect(l[2].meses['2026-09']).toBeNull();
    expect(linhasDoFaturamento([{ codigo: 30, nome: 'C', regime: 'Real' }], ['2026-09'], doMes, true)).toEqual([]);
    const p = planilhaDoFaturamento(l.slice(0, 1), ['2026-08', '2026-09']);
    expect(p.cabecalho).toEqual(['Cód.', 'Cliente', 'Regime', 'ago/26', 'set/26', 'Total', 'Variação (%)', 'Fonte']);
    expect(p.linhas[0]).toEqual([10, 'A', 'Simples', 1000, 1500, 2500, 50, 'SIEG · NF-e/NFC-e emitidas']);
  });
});

describe('o faturamento detalhado de um cliente (22/10/2026)', () => {
  it('mês a mês: NF-e e NFC-e separadas, as notas sem as canceladas e a variação contra o último mês com dado', () => {
    const s: Record<string, SaidasSieg> = {
      '2026-07': { codigo: '1', competencia: '2026-07', em: '', series: [{ modelo: '55', serie: '1', numeros: [1, 2, 3], canceladas: [2], valor: 1000 }, { modelo: '65', serie: '1', numeros: [10, 11], canceladas: [], valor: 250.5 }] },
      '2026-09': { codigo: '1', competencia: '2026-09', em: '', series: [{ modelo: '55', serie: '1', numeros: [4, 5], canceladas: [], valor: 1500.25 }] },
    };
    const m = mesesDoDetalhe(['2026-07', '2026-08', '2026-09'], c => s[c]);
    expect(m[0]).toMatchObject({ nfe: 1000, nfce: 250.5, notas: 4, canceladas: 1, total: 1250.5, variacao: null });
    expect(m[1]).toMatchObject({ total: null, notas: 0 });
    expect(m[2]).toMatchObject({ nfe: 1500.25, nfce: null, notas: 2, total: 1500.25, variacao: 20 });
  });
  it('as notas do mês: para quem vendeu e por CFOP, sem as canceladas', () => {
    const nota = (numero: string, doc: string, nome: string, valor: number, extra = {}) => ({ tipo: 'NF-e' as const, chave: numero, numero, serie: '1', data: '01/09/2026', emitente: { doc: '', nome: '' }, destinatario: { doc, nome }, valor, ...extra });
    const n: NotasSieg = { codigo: '1', competencia: '2026-09', em: '', pasta: '', arquivos: 0, novos: 0, recebidas: [], emitidas: [
      nota('1', '11', 'ALFA', 100, { itens: [{ ncm: '', cfop: '5102', cst: '', cest: '', valor: 60 }, { ncm: '', cfop: '5405', cst: '', cest: '', valor: 40 }] }),
      nota('2', '11', 'ALFA', 50, { cfop: '5102' }),
      nota('3', '', '', 30, { cfop: '5102' }),
      nota('4', '22', 'BETA', 999, { cancelada: true }),
    ] };
    const r = resumoDasEmitidas(n);
    expect(r).toMatchObject({ quantidade: 3, canceladas: 1, valor: 180 });
    expect(r.porCliente).toEqual([{ nome: 'ALFA', doc: '11', valor: 150, notas: 2 }, { nome: 'Consumidor (sem identificação)', doc: '', valor: 30, notas: 1 }]);
    expect(r.porCfop).toEqual([{ cfop: '5102', valor: 140 }, { cfop: '5405', valor: 40 }]);
  });
});
