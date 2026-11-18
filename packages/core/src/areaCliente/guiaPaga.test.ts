// A guia paga confirmada pelo extrato (plano do Acessórias, 18/11/2026, ficha guia-paga-confirmada).
import { describe, expect, it } from 'vitest';
import { guiasPagasPeloExtrato, saidasDosMeses, type SaidaDoExtrato } from './guiaPaga';

const s = (data: string, valor: number, historico = 'PAGAMENTO DE TRIBUTOS'): SaidaDoExtrato => ({ data, valor, historico });
const das = { id: 'das-2026-10-58', valor: 917.42, vencimento: '20/11/2026' };

describe('a guia paga pelo extrato', () => {
  it('o mesmo valor na janela marca, com a data da saída', () => {
    expect(guiasPagasPeloExtrato([das], [s('2026-11-18', -917.42)])).toEqual(new Map([['das-2026-10-58', '18/11/2026']]));
    // 20 dias antes e 3 depois ainda valem
    expect(guiasPagasPeloExtrato([das], [s('2026-10-31', -917.42)]).size).toBe(1);
    expect(guiasPagasPeloExtrato([das], [s('2026-11-23', -917.42)]).size).toBe(1);
  });
  it('fora da janela, entrada ou com juros não marca', () => {
    expect(guiasPagasPeloExtrato([das], [s('2026-10-30', -917.42)]).size).toBe(0);
    expect(guiasPagasPeloExtrato([das], [s('2026-11-24', -917.42)]).size).toBe(0);
    expect(guiasPagasPeloExtrato([das], [s('2026-11-18', 917.42)]).size).toBe(0);
    expect(guiasPagasPeloExtrato([das], [s('2026-11-25', -925.10)]).size).toBe(0);
  });
  it('duas saídas iguais: na dúvida não marca; a de cara de guia ganha da outra', () => {
    expect(guiasPagasPeloExtrato([das], [s('2026-11-18', -917.42), s('2026-11-19', -917.42)]).size).toBe(0);
    expect(guiasPagasPeloExtrato([das], [s('2026-11-18', -917.42, 'PIX ENVIADO JOAO'), s('2026-11-19', -917.42, 'PAG DAS SIMPLES NACIONAL')]))
      .toEqual(new Map([['das-2026-10-58', '19/11/2026']]));
    // sem histórico de guia, uma saída só ainda vale (o FGTS Digital pago por PIX)
    expect(guiasPagasPeloExtrato([das], [s('2026-11-18', -917.42, 'PIX QR CODE')]).size).toBe(1);
  });
  it('duas guias do mesmo valor disputando a mesma saída: nenhuma', () => {
    const outra = { id: 'fgts-2026-10-58', valor: 917.42, vencimento: '20/11/2026' };
    expect(guiasPagasPeloExtrato([das, outra], [s('2026-11-18', -917.42)]).size).toBe(0);
  });
  it('a que já está paga fica como está e não disputa', () => {
    const outra = { id: 'fgts-2026-10-58', valor: 917.42, vencimento: '20/11/2026', pagoEm: '10/11/2026' };
    expect(guiasPagasPeloExtrato([das, outra], [s('2026-11-18', -917.42)])).toEqual(new Map([['das-2026-10-58', '18/11/2026']]));
  });
  it('as saídas do cache do robô, com a data inteira', () => {
    const porMes = new Map([['2026-11', { lancamentos: [{ dia: 5, historico: 'DAS', valor: -10, conta: 'b' }, { dia: 6, historico: 'PIX', valor: 50, conta: 'b' }] }]]);
    expect(saidasDosMeses(porMes)).toEqual([{ data: '2026-11-05', valor: -10, historico: 'DAS' }]);
  });
});
