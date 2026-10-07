import { describe, expect, it } from 'vitest';
import { cobrancasDasLinhas, cobrancasDeTeste, cobrancasDoPeriodo, despesaDoRazao, lancamentosDosHonorarios } from './honorarios';
import type { RazaoDaConta } from './razao';

// as linhas do "Extrato por cobrança" da 292 (hccc.pdf, 07/10/2026), como o linhasDasPaginas monta
const PAGINA = [
  'NILMA DIAS OLIVEIRA ME Alterdata Software',
  'Período: 01/01/2026 a 31/08/2026 Extrato por cobrança Página 1 de 1',
  'Emissão Cobrança Vencimento Pagamento Valor Juros Multa Desconto Crédito utilizado Recebido A Receber',
  '(00292) FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA',
  '31/12/2025 000012904 12/01/2026 12/01/2026 1.520,00 0,00 0,00 0,00 0,00 1.520,00 0,00',
  '30/01/2026 000013074 10/02/2026 10/02/2026 1.650,00 0,00 0,00 0,00 0,00 1.650,00 0,00',
  '30/05/2026 000013883 10/06/2026 10/06/2026 2.050,00 0,00 0,00 0,00 0,00 2.050,00 0,00',
  '30/07/2026 000014277 10/08/2026 10/08/2026 1.650,00 0,00 0,00 0,00 0,00 1.650,00 0,00',
  '28/08/2026 000014470 10/09/2026 1.650,00 0,00 0,00 0,00 0,00 0,00 1.650,00',
  '13.470,00 0,00',
  'TOTAL 13.470,00 0,00',
];

describe('Honorários: o Extrato por cobrança', () => {
  it('lê cada cobrança com o cliente, as datas e os valores (a não paga sem pagamento)', () => {
    const c = cobrancasDasLinhas([PAGINA]);
    expect(c).toHaveLength(5);
    expect(c[1]).toEqual({ codigoCliente: 292, emissao: '2026-01-30', numero: '000013074', vencimento: '2026-02-10', pagamento: '2026-02-10', valor: 1650, recebido: 1650, aReceber: 0 });
    expect(c[4]).toMatchObject({ emissao: '2026-08-28', pagamento: '', valor: 1650, recebido: 0, aReceber: 1650 });
  });
  it('só as emitidas nos meses do período (dezembro/2025 fica de fora)', () => {
    const doPeriodo = cobrancasDoPeriodo(cobrancasDasLinhas([PAGINA]), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
    expect(doPeriodo.map(x => x.numero)).toEqual(['000013074', '000013883', '000014277', '000014470']);
  });
  it('os lançamentos na data de emissão: D despesa / C honorários a pagar, com o número da cobrança', () => {
    const [l] = lancamentosDosHonorarios(cobrancasDasLinhas([PAGINA]).slice(1, 2), ' 42105 ', '21405');
    expect(l).toEqual({ data: '30/01/2026', debito: '42105', credito: '21405', historico: 'Honorários contábeis conf. cobrança nº 13074', valor: 1650, documento: '13074' });
  });
  it('a despesa sugerida: a contrapartida mais comum dos créditos do razão', () => {
    const l = (valor: number, contrapartida: string) => ({ data: '2026-01-30', contrapartida, nomeContrapartida: '', valor, codigoHistorico: '', historico: '', saldo: 0 });
    const r: RazaoDaConta = { lancamentos: [l(1650, '42105'), l(-1650, '10503'), l(1650, '42105'), l(200, '42199')], saldoInicial: 0, saldoFinal: 0, inicio: '', fim: '' };
    expect(despesaDoRazao(r)).toBe('42105');
    expect(despesaDoRazao(null)).toBe('');
  });
  it('as de teste: uma por mês, a última ainda a receber', () => {
    const t = cobrancasDeTeste(['2026-07', '2026-08'], 292);
    expect(t.map(x => x.emissao)).toEqual(['2026-07-30', '2026-08-30']);
    expect(t[1]).toMatchObject({ pagamento: '', aReceber: 1650 });
  });
});
