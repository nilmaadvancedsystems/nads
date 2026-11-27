import { describe, expect, it } from 'vitest';
import { competenciasDoPeriodo, curvaAbc, faturamentoDasSaidas, linhasDoFaturamento, mesesDoDetalhe, mesesNaReceita, mesesPelaReceita, planilhaDoFaturamento, resumoDasEmitidas, type NotasSieg, type SaidasSieg } from '.';

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
    expect(l[0]).toMatchObject({ total: 2500, variacao: 50, fontes: ['SIEG · NF-e/NFC-e/NFS-e emitidas'] });
    expect(l[1]).toMatchObject({ total: 50, variacao: null });
    expect(l[2]).toMatchObject({ total: null, variacao: null, fontes: [] });
    expect(l[2].meses['2026-09']).toBeNull();
    expect(linhasDoFaturamento([{ codigo: 30, nome: 'C', regime: 'Real' }], ['2026-09'], doMes, true)).toEqual([]);
    const p = planilhaDoFaturamento(l.slice(0, 1), ['2026-08', '2026-09']);
    expect(p.cabecalho).toEqual(['Cód.', 'Cliente', 'Regime', 'ago/26', 'set/26', 'Total', 'Variação (%)', 'Fonte']);
    expect(p.linhas[0]).toEqual([10, 'A', 'Simples', 1000, 1500, 2500, 50, 'SIEG · NF-e/NFC-e/NFS-e emitidas']);
  });
  it('o PGDAS-D (25/11/2026): no Simples, só ele (o mês sem a declaração fica vazio); nos outros regimes, ele e depois o SIEG; sem PGDAS-D, o SIEG', () => {
    const meses = new Map([['2026-08', new Map([['10', saida('10', '2026-08', 1000)], ['20', saida('20', '2026-08', 400)], ['40', saida('40', '2026-08', 90)]])], ['2026-09', new Map([['10', saida('10', '2026-09', 1500)], ['20', saida('20', '2026-09', 500)]])]]);
    const doMes = (c: string) => meses.get(c) || new Map();
    const mesPg = (c: string, receita: number) => ({ competencia: c, receita, interno: receita, externo: 0, rbt12: null, declaracao: null, transmitidaEm: null, origem: 'extrato' as const, consultadoEm: '' });
    const pg = (codigo: number, ms: Record<string, number>) => ({ codigo, cnpj: '', nome: '', fonte: 'Receita (PGDAS-D)', consultadoEm: '', meses: Object.fromEntries(Object.entries(ms).map(([c, v]) => [c, mesPg(c, v)])) });
    const pgdas = new Map([[10, pg(10, { '2026-09': 1800 })], [20, pg(20, { '2026-09': 600 })], [30, pg(30, { '2026-09': 700 })]]);
    const l = linhasDoFaturamento([{ codigo: 10, nome: 'A', regime: 'Simples' }, { codigo: 20, nome: 'B', regime: 'Presumido' }, { codigo: 30, nome: 'C', regime: 'Simples' }, { codigo: 40, nome: 'D', regime: 'Simples' }],
      ['2026-08', '2026-09'], doMes, false, codigo => pgdas.get(codigo));
    const porCodigo = (c: number) => l.find(x => x.codigo === c)!;
    // Simples com o PGDAS-D: o agosto do SIEG não entra
    expect(porCodigo(10).meses).toEqual({ '2026-08': null, '2026-09': { valor: 1800, fonte: 'Receita' } });
    expect(porCodigo(10)).toMatchObject({ total: 1800, fontes: ['Receita (PGDAS-D)'] });
    // fora do Simples: a Receita onde tem, o SIEG no resto
    expect(porCodigo(20).meses).toEqual({ '2026-08': { valor: 400, fonte: 'SIEG' }, '2026-09': { valor: 600, fonte: 'Receita' } });
    expect(porCodigo(20).fontes).toEqual(['Receita (PGDAS-D)', 'SIEG · NF-e/NFC-e/NFS-e emitidas']);
    // sem nota no SIEG, a empresa aparece pela Receita
    expect(porCodigo(30)).toMatchObject({ total: 700, fontes: ['Receita (PGDAS-D)'] });
    // Simples sem PGDAS-D ainda (antes da primeira consulta do robô): segue pelo SIEG
    expect(porCodigo(40)).toMatchObject({ total: 90, fontes: ['SIEG · NF-e/NFC-e/NFS-e emitidas'] });
  });
  it('o detalhe pela Receita no Simples (25/11/2026): o total é a receita declarada, as notas seguem do SIEG', () => {
    const detalhe = mesesDoDetalhe(['2026-08', '2026-09'], c => saida('10', c, c === '2026-08' ? 1000 : 1500));
    const pg = { codigo: 10, cnpj: '', nome: '', fonte: 'Receita (PGDAS-D)', consultadoEm: '',
      meses: { '2026-09': { competencia: '2026-09', receita: 1800, interno: 1800, externo: 0, rbt12: null, declaracao: null, transmitidaEm: null, origem: 'extrato' as const, consultadoEm: '' } } };
    expect(mesesPelaReceita(detalhe, pg, 'Simples').map(m => [m.competencia, m.total, m.nfe, m.variacao])).toEqual([['2026-08', null, 1000, null], ['2026-09', 1800, 1500, null]]);
    expect(mesesPelaReceita(detalhe, pg, 'Presumido').map(m => m.total)).toEqual([1000, 1500]);
    expect(mesesPelaReceita(detalhe, null, 'Simples').map(m => m.total)).toEqual([1000, 1500]);
  });
  it('a Receita ao lado das notas no detalhe (25/11/2026)', () => {
    const detalhe = mesesDoDetalhe(['2026-08', '2026-09', '2026-10'], c => (c === '2026-10' ? null : saida('10', c, c === '2026-08' ? 1000 : 1500)));
    const pg = { codigo: 10, cnpj: '', nome: '', fonte: 'Receita (PGDAS-D)', consultadoEm: '',
      meses: { '2026-09': { competencia: '2026-09', receita: 1800, interno: 1800, externo: 0, rbt12: null, declaracao: null, transmitidaEm: null, origem: 'extrato' as const, consultadoEm: '' } } };
    expect(mesesNaReceita(detalhe, pg)).toEqual([
      { competencia: '2026-08', receita: null, notas: 1000, diferenca: null },
      { competencia: '2026-09', receita: 1800, notas: 1500, diferenca: 300 },
      { competencia: '2026-10', receita: null, notas: null, diferenca: null },
    ]);
    expect(mesesNaReceita(detalhe, null)).toBeNull();
    expect(mesesNaReceita(detalhe, { ...pg, meses: {} })).toBeNull();
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

describe('a curva ABC dos compradores', () => {
  it('A até 80% do acumulado, B até 95%, C o resto, e a concentração', () => {
    const r = curvaAbc([{ nome: 'c', valor: 10 }, { nome: 'a', valor: 70 }, { nome: 'b', valor: 15 }, { nome: 'd', valor: 5 }]);
    expect(r.linhas.map(l => [l.nome, l.classe, l.acumulado])).toEqual([['a', 'A', 70], ['b', 'A', 85], ['c', 'B', 95], ['d', 'C', 100]]);
    expect(r.porClasse.A).toEqual({ clientes: 2, valor: 85, pct: 85 });
    expect(r.maior).toBe(70);
    expect(r.cinco).toBe(100);
    expect(curvaAbc([]).maior).toBe(0);
  });
});

describe('a nota de serviço nas saídas (27/11/2026: a Zelo, 602, só emite NFS-e)', () => {
  it('a NFS-e entra no faturamento do mês, nas notas e no detalhe', async () => {
    const { faturamentoDasSaidas, mesesDoDetalhe } = await import('./faturamento');
    const s = { codigo: '602', competencia: '2026-10', em: '', series: [], servicos: { notas: 2, valor: 27352.39 } };
    expect(faturamentoDasSaidas(s)).toBe(27352.39);
    expect(mesesDoDetalhe(['2026-10'], () => s)[0]).toMatchObject({ nfe: null, nfce: null, nfse: 27352.39, notas: 2, total: 27352.39 });
    expect(faturamentoDasSaidas({ ...s, servicos: undefined })).toBe(0);
  });
});

