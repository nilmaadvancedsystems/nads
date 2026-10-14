import { describe, expect, it } from 'vitest';
import type { Titulo } from '../tipos';
import { CONTAS_PADRAO } from '../tipos';
import { casarComExtrato, creditosDeLiquidacao, liberacoesDeTD, titulosDescontados } from './extrato';
import { fecharPeloExtrato, gerarLancamentos } from './lancamentos';

const t = (id: number, liquidacao: string, valor: number): Titulo => ({ id, sacado: 'C' + id, nossoNumero: '', nf: String(100 + id), valor, mora: 0, desconto: 0, outros: 0, liquidacao, cobrado: null });

describe('o Creditor obedece o extrato', () => {
  it('lê só os créditos de liquidação do extrato', () => {
    const cs = creditosDeLiquidacao([
      { data: '2026-02-18', valor: 20000, historico: 'CRÉD.LIQUIDAÇÃO COBRANÇA' },
      { data: '2026-02-02', valor: 32300, historico: 'CRED.LIQ.COBRANCA DOC.: 7701' },
      { data: '2026-02-06', valor: 700000, historico: 'CRÉD.LIBERAÇÃO TD' },
      { data: '2026-02-06', valor: -1490, historico: 'TARIFA COBRANÇA' },
    ]);
    expect(cs).toEqual([
      { data: '02/02/2026', valor: 323, historico: 'CRED.LIQ.COBRANCA DOC.: 7701' },
      { data: '18/02/2026', valor: 200, historico: 'CRÉD.LIQUIDAÇÃO COBRANÇA' },
    ]);
  });

  it('o título que o banco não creditou fica fora; o casado vai com a data do crédito', () => {
    // o relatório tem 5.000,00 em 09/02, o extrato não
    const titulos = [t(1, '30/01/2026', 200), t(2, '30/01/2026', 123), t(3, '09/02/2026', 5000), t(4, '13/02/2026', 150), t(5, '18/02/2026', 50)];
    const creditos = [{ data: '02/02/2026', valor: 323, historico: '' }, { data: '18/02/2026', valor: 200, historico: '' }];
    const c = casarComExtrato(titulos, creditos, ['2026-01', '2026-02']);
    expect(c.semCredito.map(x => x.id)).toEqual([3]);
    expect(c.creditos.map(x => x.titulos.sort())).toEqual([[1, 2], [4, 5]]);
    const cruz = titulos.map(x => ({ tituloId: x.id, situacao: 'ok' as const, linha: { linha: 1, nf: x.nf, cliente: '', contrapartida: '10301', historico: 'NF', valor: x.valor } }));
    const usados = titulos.filter(x => c.dataDoCredito.has(x.id));
    const ls = gerarLancamentos(usados, cruz as never, {}, CONTAS_PADRAO, c.dataDoCredito);
    expect(ls.map(l => l.data + ' ' + l.valor)).toEqual(['02/02/2026 200', '02/02/2026 123', '18/02/2026 150', '18/02/2026 50']);
    expect(fecharPeloExtrato(c, ls, [], CONTAS_PADRAO).every(f => f.situacao === 'ok')).toBe(true);
  });

  it('os sem crédito que vieram de um TD (a liberação adiantou o dinheiro)', () => {
    const tds = liberacoesDeTD([
      { data: '2026-01-19', valor: 1250000, historico: '100 CRÉD.LIBERAÇÃO TD' },
      { data: '2026-02-06', valor: 700000, historico: '101 CRÉD.LIBERAÇÃO TD' },
      { data: '2026-01-19', valor: -30000, historico: 'DÉB.JUROS CONTRATUAIS TD' },
    ]);
    expect(tds.map(x => x.data + ' ' + x.valor)).toEqual(['19/01/2026 12500', '06/02/2026 7000']);
    const semCredito = [t(1, '09/02/2026', 5000), t(2, '27/02/2026', 7500), t(3, '27/02/2026', 2000), t(4, '10/03/2026', 4000), t(5, '05/03/2026', 1000), t(6, '05/03/2026', 99)];
    const d = titulosDescontados(semCredito, tds);
    expect([1, 2].map(id => d.get(id)?.data)).toEqual(['19/01/2026', '19/01/2026']);
    expect([3, 4, 5].map(id => d.get(id)?.data)).toEqual(['06/02/2026', '06/02/2026', '06/02/2026']);
    expect(d.has(6)).toBe(false);
  });

  it('o mês sem extrato importado não é filtrado', () => {
    const c = casarComExtrato([t(1, '10/03/2026', 99)], [], ['2026-02']);
    expect(c.semCredito).toEqual([]);
    expect(c.dataDoCredito.size).toBe(0);
  });
});
