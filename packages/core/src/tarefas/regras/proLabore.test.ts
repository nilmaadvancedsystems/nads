import { describe, expect, it } from 'vitest';
import { lerRazao } from './razao';
import { dataDoPagamentoDoProLabore, mesesDoProLabore, pagamentosDoProLabore } from './proLabore';

// o razão do Pró-labore a pagar no formato da conciliação do Alterdata (crédito positivo), nomes inventados
const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const linhas = (inicial: number, ls: [string, string, number, string][]) => {
  let saldo = inicial;
  return [CAB, ...ls.map(([data, contra, valor, hist]) => { saldo = Math.round((saldo + valor) * 100) / 100; return ['', '', data, '', contra, '', valor, '', hist, saldo, '']; })];
};
const PROV = (m: string, socio: string) => 'Pelo valor de retirada pró-labore a pagar ?  <' + m + '> ' + socio;
const INSS = (m: string, socio: string) => 'Pelo valor de INSS a recolher descontado s/ retirada pró-labore  <' + m + '> ' + socio;

describe('os pagamentos do pró-labore', () => {
  it('o líquido de cada competência e sócio; o saldo de antes vira a competência anterior', () => {
    const r = lerRazao(linhas(2702.04, [
      ['31/01/2026', '52003', -356.62, INSS('01/2026', 'FULANO DE TAL')],
      ['31/01/2026', '87002', 3242, PROV('01/2026', 'FULANO DE TAL')],
      ['28/02/2026', '52003', -356.62, INSS('02/2026', 'FULANO DE TAL')],
      ['28/02/2026', '87002', 3242, PROV('02/2026', 'FULANO DE TAL')],
    ]));
    expect(pagamentosDoProLabore(r).map(p => [p.competencia, p.valor, p.data, p.historico, !!p.doSaldoAnterior])).toEqual([
      ['2025-12', 2702.04, '2025-12-31', 'Pagamento de pro-labore 12/2025 FULANO DE TAL', true],
      ['2026-01', 2885.38, '2026-01-31', 'Pagamento de pro-labore 01/2026 FULANO DE TAL', false],
      ['2026-02', 2885.38, '2026-02-28', 'Pagamento de pro-labore 02/2026 FULANO DE TAL', false],
    ]);
  });
  it('o que já foi pago some: com a competência no histórico, dela; sem, das mais antigas', () => {
    const r = lerRazao(linhas(0, [
      ['31/01/2026', '87002', 1000, PROV('01/2026', 'A')],
      ['31/01/2026', '87002', 500, PROV('01/2026', 'B')],
      ['05/02/2026', '10503', -500, 'Pagamento de pro-labore <01/2026> B'],
      ['28/02/2026', '87002', 1000, PROV('02/2026', 'A')],
      ['05/03/2026', '10503', -1000, 'Pix enviado'],
    ]));
    expect(pagamentosDoProLabore(r).map(p => [p.competencia, p.socio, p.valor])).toEqual([['2026-02', 'A', 1000]]);
  });
});

describe('os pagamentos batem com a grade dos meses (18/11/2026)', () => {
  it('o pagamento com o nome do sócio diferente e o "mm/aaaa" sem sócio abatem a competência; o mês seguinte fica de fora', () => {
    const r = lerRazao(linhas(0, [
      ['31/08/2026', '52003', -100, INSS('08/2026', 'CARLOS HUMBERTO')],
      ['31/08/2026', '87002', 1000, PROV('08/2026', 'CARLOS HUMBERTO')],
      ['05/09/2026', '10501', -900, 'Pagamento de pro-labore <08/2026> CARLOS H.'],
      ['30/09/2026', '52003', -100, INSS('09/2026', 'CARLOS HUMBERTO')],
      ['30/09/2026', '87002', 1000, PROV('09/2026', 'CARLOS HUMBERTO')],
      ['05/10/2026', '10101', -900, 'Pagamento de pro-labore 09/2026 CARLOS HUMBERTO'],
      ['31/10/2026', '52003', -100, INSS('10/2026', 'CARLOS HUMBERTO')],
      ['31/10/2026', '87002', 1000, PROV('10/2026', 'CARLOS HUMBERTO')],
    ]));
    expect(pagamentosDoProLabore(r, undefined, '2026-09')).toEqual([]);
    expect(pagamentosDoProLabore(r).map(p => [p.competencia, p.valor])).toEqual([['2026-10', 900]]);
    const { meses } = mesesDoProLabore(r, ['2026-08', '2026-09']);
    expect(meses.map(m => m.situacao)).toEqual(['pago', 'pago']);
  });
});

describe('dataDoPagamentoDoProLabore (o 5º dia útil do mês seguinte)', () => {
  it('sem sábado, domingo e feriado', () => {
    expect(dataDoPagamentoDoProLabore('2026-01')).toBe('06/02/2026'); // fev/26: 2, 3, 4, 5, 6
    expect(dataDoPagamentoDoProLabore('2026-03')).toBe('08/04/2026'); // abr/26: 1, 2, (3 Sexta-feira Santa), 6, 7, 8
    expect(dataDoPagamentoDoProLabore('2026-07')).toBe('07/08/2026'); // ago/26: 3, 4, 5, 6, 7
    expect(dataDoPagamentoDoProLabore('2026-12')).toBe('08/01/2027'); // jan/27: (1 feriado), 4, 5, 6, 7, 8
  });
  it('o 1º ao 5º dia útil, à escolha', () => {
    expect(dataDoPagamentoDoProLabore('2026-01', 1)).toBe('02/02/2026');
    expect(dataDoPagamentoDoProLabore('2026-03', 3)).toBe('06/04/2026'); // 1, 2, (3 feriado), 6
    expect(dataDoPagamentoDoProLabore('2026-12', 1)).toBe('04/01/2027');
  });
});

describe('mesesDoProLabore (pago ou não, mês a mês)', () => {
  it('a provisão, o INSS, o pago e o que falta; o pagamento sem competência abate o saldo de antes e as mais antigas', () => {
    const r = lerRazao(linhas(500, [
      ['31/01/2026', '52003', -100, INSS('01/2026', 'A')],
      ['31/01/2026', '87002', 1000, PROV('01/2026', 'A')],
      ['05/02/2026', '10503', -900, 'Pagamento de pro-labore 01/2026 A'],
      ['28/02/2026', '52003', -100, INSS('02/2026', 'A')],
      ['28/02/2026', '87002', 1000, PROV('02/2026', 'A')],
      ['05/03/2026', '10501', -800, 'Pix enviado'],
      ['31/03/2026', '52003', -100, INSS('03/2026', 'A')],
      ['31/03/2026', '87002', 1000, PROV('03/2026', 'A')],
    ]));
    const { meses, anterior } = mesesDoProLabore(r, ['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(anterior).toEqual({ valor: 500, falta: 0 });
    expect(meses.map(m => [m.mes, m.liquido, m.pago, m.falta, m.situacao])).toEqual([
      ['2026-01', 900, 900, 0, 'pago'],
      ['2026-02', 900, 300, 600, 'parcial'],
      ['2026-03', 900, 0, 900, 'falta'],
      ['2026-04', 0, 0, 0, 'sem'],
    ]);
    expect(meses[0].pagoEm).toEqual(['2026-02-05']);
    expect(meses[1].saldo).toBe(1400);
    expect(meses[2].saldo).toBe(1500);
  });
});
