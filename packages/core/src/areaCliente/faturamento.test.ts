// O Faturamento da Área do Cliente (12/11/2026): os 12 meses de cada empresa pelas notas emitidas no SIEG.
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { SaidasSieg } from '../tarefas/sieg';
import { bancosDoFaturamento, comOBanco, competenciasDoFaturamento, lancamentosDoMes, MAIOR_LISTA_DE_LANCAMENTOS, movimentoDasContas, detalheDoMes, entradasDosExtratos, faturadoXBanco, faturamentoDoCliente, painelDoFaturamento, planilhaDoFaturamento, seriesDoMes, type MesDoFaturamento } from './faturamento';

const saida = (codigo: string, competencia: string, nfe: number, nfce = 0): SaidasSieg => ({
  codigo, competencia, em: '',
  series: [
    { modelo: '55', serie: '1', numeros: [1, 2, 3], canceladas: [3], valor: nfe },
    ...(nfce ? [{ modelo: '65', serie: '1', numeros: [10, 11], canceladas: [], valor: nfce }] : []),
  ],
});

describe('o faturamento do cliente', () => {
  it('de janeiro do ano passado até o mês de hoje (para comparar o acumulado do ano)', () => {
    const c = competenciasDoFaturamento(new Date(2026, 10, 12));
    expect([c[0], c[c.length - 1], c.length]).toEqual(['2025-01', '2026-11', 23]);
    expect(competenciasDoFaturamento(new Date(2026, 0, 5)).length).toBe(13);
  });

  it('cada empresa com os meses do SIEG (a canceladas fora); a sem nenhum mês fica de fora; sem nada, null', () => {
    const base = new Map([['292_2026-09', saida('292', '2026-09', 1000)], ['292_2026-10', saida('292', '2026-10', 800, 400)]]);
    const r = faturamentoDoCliente([{ codigo: 292, nome: 'FITO', regime: 'Simples' }, { codigo: 58, nome: 'SEM NOTA' }], ['2026-09', '2026-10', '2026-11'],
      (c, m) => base.get(c + '_' + m), new Date(2026, 10, 12, 10));
    expect(r?.empresas.map(e => [e.codigo, e.regime])).toEqual([[292, 'Simples']]);
    expect(r?.fonte).toBe('SIEG · NF-e/NFC-e emitidas');
    expect(r?.empresas[0].meses[1].series).toEqual([
      { modelo: '55', serie: '1', primeira: 1, ultima: 3, notas: 2, canceladas: 1, valor: 800 },
      { modelo: '65', serie: '1', primeira: 10, ultima: 11, notas: 2, canceladas: 0, valor: 400 },
    ]);
    expect([r?.empresas[0].meses[1].canceladas, r?.empresas[0].meses[2].series]).toEqual([1, undefined]);
    expect(r?.empresas[0].meses.map(m => [m.competencia, m.nfe, m.nfce, m.notas, m.total, m.variacao])).toEqual([
      ['2026-09', 1000, null, 2, 1000, null],
      ['2026-10', 800, 400, 4, 1200, 20],
      ['2026-11', null, null, 0, null, null],
    ]);
    expect(faturamentoDoCliente([{ codigo: 58, nome: 'X' }], ['2026-10'], () => null, new Date())).toBeNull();
  });

});

// os meses de exemplo: de jan/2025 a nov/2026 (hoje, 12/11/2026), R$ 10 mil por mês em 2025 e R$ 12 mil em 2026
const mes = (competencia: string, total: number | null): MesDoFaturamento =>
  ({ competencia, nfe: total, nfce: null, notas: total == null ? 0 : 10, total, variacao: null });
const HOJE = new Date(2026, 10, 12);
const exemplo = competenciasDoFaturamento(HOJE).map(c => mes(c, c.startsWith('2025') ? 10000 : c === '2026-11' ? 3000 : 12000));

describe('o painel do Faturamento', () => {
  it('o gráfico com os 12 últimos meses; o de hoje em andamento, fora do último mês e dos 12 meses', () => {
    const p = painelDoFaturamento(exemplo, 'Presumido', HOJE);
    expect([p.meses.length, p.meses[0].competencia, p.meses[11].competencia, p.emAndamento]).toEqual([12, '2025-12', '2026-11', '2026-11']);
    expect(p.ultimo?.competencia).toBe('2026-10');
    // nov/2025 a out/2026: 2 meses de 2025 (10 mil) e 10 de 2026 (12 mil)
    expect(p.doze).toEqual({ total: 140000, media: 11666.67, mesesComDado: 12 });
    expect(p.limite).toBeNull();
  });

  it('o acumulado do ano até o mês passado, contra os mesmos meses do ano passado', () => {
    expect(painelDoFaturamento(exemplo, '', HOJE).ano).toEqual({ ano: 2026, ate: '2026-10', total: 120000, anterior: 100000, variacao: 20 });
    // faltou um mês do ano passado: sem comparação (nada é inventado)
    const furado = exemplo.map(m => (m.competencia === '2025-03' ? mes('2025-03', null) : m));
    expect(painelDoFaturamento(furado, '', HOJE).ano?.variacao).toBeNull();
    // em janeiro ainda não há mês fechado no ano
    expect(painelDoFaturamento(exemplo, '', new Date(2026, 0, 10)).ano).toBeNull();
  });

  it('o limite do Simples e do MEI pelo ano-calendário (com o mês em andamento); nos outros regimes, nada', () => {
    const simples = painelDoFaturamento(exemplo, 'Simples', HOJE).limite;
    expect(simples).toMatchObject({ teto: 4_800_000, sublimite: 3_600_000, usado: 123000, situacao: 'ok' });
    const mei = painelDoFaturamento(exemplo.map(m => ({ ...m, total: m.total == null ? null : m.total / 200 })), 'MEI', HOJE).limite;
    expect(mei).toMatchObject({ teto: 81_000, usado: 615, situacao: 'ok' });
    const perto = painelDoFaturamento([mes('2026-05', 70000)], 'MEI', HOJE).limite;
    expect([perto?.situacao, Math.round((perto?.fracao ?? 0) * 100)]).toEqual(['perto', 86]);
    expect(painelDoFaturamento([mes('2026-05', 90000)], 'MEI', HOJE).limite?.situacao).toBe('passou');
    expect(painelDoFaturamento([mes('2026-05', 3_700_000)], 'Simples', HOJE).limite?.situacao).toBe('sublimite');
    expect(painelDoFaturamento(exemplo, 'Real', HOJE).limite).toBeNull();
  });

  it('a planilha do Excel: um mês por linha, do mais novo ao mais antigo, os valores como número em reais', () => {
    const bytes = planilhaDoFaturamento({ nome: 'FITO LTDA', meses: [mes('2026-09', 1234.5), mes('2026-10', null)] }, 'SIEG');
    const ws = XLSX.read(bytes, { type: 'array', cellNF: true }).Sheets.Faturamento;
    const linhas = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, defval: null });
    expect(linhas[0][0]).toBe('FITO LTDA');
    expect(linhas[3]).toEqual(['Mês', 'NF-e', 'NFC-e', 'Notas', 'Canceladas', 'Total', 'Variação (%)']);
    expect(linhas[4][0]).toBe('10/2026');
    expect(linhas[4].slice(1).every(v => v == null)).toBe(true);
    expect([linhas[5][0], linhas[5][1], linhas[5][3], linhas[5][5]]).toEqual(['09/2026', 1234.5, 10, 1234.5]);
    expect((ws.F6 as XLSX.CellObject).z).toBe('"R$" #,##0.00');
  });
});

describe('o detalhamento do mês (o clique na tabela ou no gráfico)', () => {
  it('a média por nota, o mês anterior, o mesmo mês do ano passado e o peso no ano', () => {
    const d = detalheDoMes(exemplo, '2026-10', HOJE);
    expect(d?.ticketMedio).toBe(1200);
    expect(d?.anterior).toEqual({ competencia: '2026-09', total: 12000, diferenca: 0, variacao: 0 });
    expect(d?.anoPassado).toEqual({ competencia: '2025-10', total: 10000, diferenca: 2000, variacao: 20 });
    // 2026 até hoje: 10 meses de 12 mil e novembro com 3 mil = 123 mil
    expect([d?.noAno, d?.emAndamento]).toEqual([9.8, false]);
    expect(detalheDoMes(exemplo, '2026-11', HOJE)?.emAndamento).toBe(true);
  });

  it('o mês sem nota não compara nada; o mês fora da lista, null', () => {
    const d = detalheDoMes([mes('2026-09', 500), mes('2026-10', null)], '2026-10', HOJE);
    expect([d?.ticketMedio, d?.anterior, d?.anoPassado, d?.noAno]).toEqual([null, null, null, null]);
    expect(detalheDoMes(exemplo, '2020-01', HOJE)).toBeNull();
  });

  it('as séries: a numeração, as notas sem as canceladas, a NF-e antes da NFC-e', () => {
    expect(seriesDoMes({ codigo: '1', competencia: '2026-10', em: '', series: [
      { modelo: '65', serie: '2', numeros: [5, 7, 6], canceladas: [], valor: 30 },
      { modelo: '55', serie: '1', numeros: [100, 101], canceladas: [101], valor: 50.555 },
    ] })).toEqual([
      { modelo: '55', serie: '1', primeira: 100, ultima: 101, notas: 1, canceladas: 1, valor: 50.56 },
      { modelo: '65', serie: '2', primeira: 5, ultima: 7, notas: 3, canceladas: 0, valor: 30 },
    ]);
    expect(seriesDoMes(null)).toEqual([]);
  });
});

describe('o faturado contra o que entrou no banco (13/11/2026)', () => {
  const mes = (competencia: string, total: number | null, entradas?: number) => ({
    competencia, nfe: null, nfce: null, notas: 0, total, variacao: null, ...(entradas != null ? { banco: { entradas, contas: 2 } } : {}),
  });
  const meses = [mes('2026-05', 100), mes('2026-06', 100, 95), mes('2026-07', 100, 70), mes('2026-08', 100, 140), mes('2026-09', null, 50), mes('2026-10', 200)];
  it('acompanha (90% a 115%), entrou menos, entrou mais', () => {
    expect(faturadoXBanco(meses, '2026-06').mes).toMatchObject({ faturado: 100, entradas: 95, diferenca: -5, cobertura: 95, tom: 'bom' });
    expect(faturadoXBanco(meses, '2026-07').mes).toMatchObject({ cobertura: 70, tom: 'atencao' });
    expect(faturadoXBanco(meses, '2026-07').mes.leitura).toMatch(/menos/);
    expect(faturadoXBanco(meses, '2026-08').mes.leitura).toMatch(/mais/);
  });
  it('sem extrato, sem nota', () => {
    expect(faturadoXBanco(meses, '2026-10').mes).toMatchObject({ entradas: null, diferenca: null, cobertura: null, tom: 'neutro' });
    expect(faturadoXBanco(meses, '2026-09').mes.leitura).toMatch(/não tem nota/);
  });
  it('a série dos 6 meses até o escolhido e se há banco', () => {
    const r = faturadoXBanco(meses, '2026-10');
    expect(r.serie.map(m => m.competencia)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(r.temBanco).toBe(true);
    expect(faturadoXBanco([mes('2026-05', 100)], '2026-05').temBanco).toBe(false);
    // a série não anda com o mês escolhido: são sempre os últimos 6 meses com dado
    expect(faturadoXBanco(meses, '2026-05').serie.map(m => m.competencia)).toEqual(r.serie.map(m => m.competencia));
  });
});

describe('as entradas dos extratos (13/11/2026)', () => {
  it('soma os créditos do lado do banco por mês, sem repetir o mesmo lançamento, e conta as contas', () => {
    const r = entradasDosExtratos([
      { lado: 'banco', banco: 'bb', lancamentos: [{ data: '2026-10-02', valor: 10000, historico: 'PIX' }, { data: '2026-10-03', valor: -5000 }, { data: '2026-11-01', valor: 250 }] },
      { lado: 'banco', banco: 'bb', lancamentos: [{ data: '2026-10-02', valor: 10000, historico: 'PIX' }] },
      { lado: 'banco', banco: 'itau', lancamentos: [{ data: '2026-10-10', valor: 1999 }] },
      { lado: 'sistema', banco: 'bb', lancamentos: [{ data: '2026-10-05', valor: 99999 }] },
    ]);
    expect(r).toEqual({
      '2026-10': { entradas: 119.99, saidas: 50, contas: 2, porBanco: [{ id: 'bb', nome: 'Bb', entradas: 100, saidas: 50 }, { id: 'itau', nome: 'Itau', entradas: 19.99, saidas: 0 }] },
      '2026-11': { entradas: 2.5, saidas: 0, contas: 1, porBanco: [{ id: 'bb', nome: 'Bb', entradas: 2.5, saidas: 0 }] },
    });
    // com os bancos do Extrator: o nome e a marca; o arquivo sem banco é do primeiro
    const r2 = entradasDosExtratos([{ lado: 'banco', lancamentos: [{ data: '2026-10-02', valor: 500 }] }], [{ id: 'itau-1-2', nome: 'Itaú', marca: 'itau' }]);
    expect(r2['2026-10'].porBanco).toEqual([{ id: 'itau-1-2', nome: 'Itaú', marca: 'itau', entradas: 5, saidas: 0 }]);
  });
  it('o faturamento com o banco só nos meses e empresas que têm extrato', () => {
    const fat = { fonte: 'x', atualizadoEm: '', empresas: [
      { codigo: 1, nome: 'A', meses: [{ competencia: '2026-10', nfe: null, nfce: null, notas: 0, total: 100, variacao: null }, { competencia: '2026-11', nfe: null, nfce: null, notas: 0, total: 50, variacao: null }] },
      { codigo: 2, nome: 'B', meses: [{ competencia: '2026-10', nfe: null, nfce: null, notas: 0, total: 10, variacao: null }] },
    ] };
    const r = comOBanco(fat, c => (c === 1 ? { '2026-10': { entradas: 90, contas: 1 } } : null));
    expect(r.empresas[0].meses.map(m => m.banco ?? null)).toEqual([{ entradas: 90, contas: 1 }, null]);
    expect(r.empresas[1]).toBe(fat.empresas[1]);
  });
});

describe('a escolha do banco no Faturamento (13/11/2026)', () => {
  const mes = (competencia: string, total: number, por: [string, number][]) => ({
    competencia, nfe: null, nfce: null, notas: 0, total, variacao: null,
    banco: { entradas: por.reduce((a, [, v]) => a + v, 0), contas: por.length, porBanco: por.map(([id, entradas]) => ({ id, nome: id.toUpperCase(), entradas })) },
  });
  const meses = [mes('2026-09', 100, [['itau', 60], ['sicoob', 30]]), mes('2026-10', 100, [['itau', 70], ['sicoob', 25]])];
  it('os bancos, o que mais recebeu primeiro', () => {
    expect(bancosDoFaturamento(meses).map(b => b.id)).toEqual(['itau', 'sicoob']);
  });
  it('com um banco, as entradas só dele e a parte dele no mês', () => {
    const r = faturadoXBanco(meses, '2026-10', 'sicoob');
    expect(r.mes).toMatchObject({ entradas: 25, cobertura: 25, tom: 'neutro' });
    expect(r.mes.leitura).toBe('SICOOB recebeu 26,3% do que entrou nas contas no mês.');
    expect(r.serie.map(m => m.entradas)).toEqual([30, 25]);
    expect(faturadoXBanco(meses, '2026-10').mes.entradas).toBe(95);
  });
});

describe('o movimento das contas no mês (13/11/2026)', () => {
  it('entrou, saiu e ficou, no total e por conta, com a parte de cada uma', () => {
    const meses = [{ competencia: '2026-10', nfe: null, nfce: null, notas: 0, total: 100, variacao: null,
      banco: { entradas: 100, saidas: 70, contas: 2, porBanco: [{ id: 'a', nome: 'A', entradas: 75, saidas: 60 }, { id: 'b', nome: 'B', entradas: 25, saidas: 10 }] } }];
    expect(movimentoDasContas(meses, '2026-10')).toEqual({
      entradas: 100, saidas: 70, resultado: 30, saldo: null,
      contas: [{ id: 'a', nome: 'A', entradas: 75, saidas: 60, resultado: 15, parte: 75, saldo: null }, { id: 'b', nome: 'B', entradas: 25, saidas: 10, resultado: 15, parte: 25, saldo: null }],
    });
    expect(movimentoDasContas(meses, '2026-09')).toBeNull();
  });
});

describe('o saldo e os lançamentos do mês (13/11/2026)', () => {
  const arquivos = [
    { lado: 'banco', banco: 'a', lancamentos: [{ data: '2026-10-05', valor: 10000, historico: 'PIX   RECEBIDO' }, { data: '2026-10-02', valor: -2500, historico: 'TARIFA' }],
      saldosDoDia: [{ data: '2026-10-02', saldo: 50000 }, { data: '2026-10-31', saldo: 57500 }, { data: '2026-11-03', saldo: 1 }] },
    { lado: 'banco', banco: 'b', lancamentos: [{ data: '2026-10-05', valor: 3000, historico: 'TED' }], saldosDoDia: [{ data: '2026-10-30', saldo: 12000 }] },
    { lado: 'banco', banco: 'a', lancamentos: [{ data: '2026-10-05', valor: 10000, historico: 'PIX   RECEBIDO' }] },
  ];
  it('o saldo de cada conta no último dia do mês, e o de todas quando todas trazem', () => {
    const r = entradasDosExtratos(arquivos);
    expect(r['2026-10'].porBanco.map(b => [b.id, b.saldo])).toEqual([['a', { valor: 575, data: '2026-10-31' }], ['b', { valor: 120, data: '2026-10-30' }]]);
    expect(r['2026-10'].saldo).toEqual({ valor: 695, data: '2026-10-31' });
    const sem = entradasDosExtratos([arquivos[0], { lado: 'banco', banco: 'c', lancamentos: [{ data: '2026-10-09', valor: 100 }] }]);
    expect(sem['2026-10'].saldo).toBeUndefined();
  });
  it('os lançamentos do mês por dia, sem repetir, com o histórico limpo e o teto', () => {
    expect(lancamentosDoMes(arquivos, '2026-10')).toEqual({ cortados: 0, lancamentos: [
      { dia: 2, historico: 'TARIFA', valor: -25, conta: 'a' },
      { dia: 5, historico: 'PIX RECEBIDO', valor: 100, conta: 'a' },
      { dia: 5, historico: 'TED', valor: 30, conta: 'b' },
    ] });
    const muitos = [{ lado: 'banco', banco: 'a', lancamentos: Array.from({ length: MAIOR_LISTA_DE_LANCAMENTOS + 3 }, (_, i) => ({ data: '2026-10-01', valor: i + 1, historico: 'x' })) }];
    expect(lancamentosDoMes(muitos, '2026-10').cortados).toBe(3);
  });
});
