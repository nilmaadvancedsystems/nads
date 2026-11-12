// O Faturamento da Área do Cliente (12/11/2026): os 12 meses de cada empresa pelas notas emitidas no SIEG.
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import type { SaidasSieg } from '../tarefas/sieg';
import { competenciasDoFaturamento, detalheDoMes, faturamentoDoCliente, painelDoFaturamento, planilhaDoFaturamento, seriesDoMes, type MesDoFaturamento } from './faturamento';

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
