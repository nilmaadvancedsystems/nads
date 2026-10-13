import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { chequeDaViradaDoAno, diasNegativos, situacaoDoBancoNoPeriodo } from './situacaoDoBanco';

const arq = (id: string, lado: 'banco' | 'sistema', lancamentos: Lancamento[], saldoAnterior?: number): ArquivoImportado =>
  ({ id, lado, nome: id, importadoEm: '2026-10-01T12:00:00Z', modo: 'primeira', lancamentos, ...(saldoAnterior != null ? { saldoAnterior } : {}) });
const L = (data: string, valor: number, historico: string): Lancamento => ({ data, valor, historico });
const emp = (arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'X', arquivos, auditoria: [] });

// saldo anterior 100,00; 03/03 sai 150,00 (fecha −50,00); 04/03 entra 80,00 (fecha 30,00)
const EXTRATO = [L('2026-03-03', -15000, 'PIX ENVIADO'), L('2026-03-04', 8000, 'PIX RECEBIDO')];
const RAZAO = [L('2026-03-03', -15000, 'Pagamento'), L('2026-03-04', 8000, 'Recebimento')];
const CHEQUE = [L('2026-03-03', 5000, 'Ajuste cheque especial'), L('2026-03-04', -5000, 'Estorno cheque especial')];
const M = ['2026-03'];

describe('cheque especial no banco', () => {
  it('acha os dias que fecham negativos no extrato', () => {
    const e = emp([arq('e', 'banco', EXTRATO, 10000)]);
    expect(diasNegativos(e, 'b', 'b', M)).toEqual([{ data: '2026-03-03', saldo: -5000 }]);
  });
  it('batem, mas com dia negativo e sem o cheque especial: falta o cheque', () => {
    const e = emp([arq('e', 'banco', EXTRATO, 10000), arq('r', 'sistema', RAZAO)]);
    expect(situacaoDoBancoNoPeriodo(e, 'b', 'b', M)).toEqual({ tipo: 'falta-cheque', negativos: [{ data: '2026-03-03', saldo: -5000 }], faltam: [{ data: '2026-03-03', saldo: -5000 }] });
  });
  it('com o ajuste e o estorno no razão: Ok (o cheque especial sai da conferência)', () => {
    const e = emp([arq('e', 'banco', EXTRATO, 10000), arq('r', 'sistema', [...RAZAO, ...CHEQUE])]);
    expect(situacaoDoBancoNoPeriodo(e, 'b', 'b', M).tipo).toBe('ok');
  });
  it('cheque com o valor errado: não bate (fica pendente)', () => {
    const e = emp([arq('e', 'banco', EXTRATO, 10000), arq('r', 'sistema', [...RAZAO, L('2026-03-03', 4000, 'Ajuste'), L('2026-03-04', -4000, 'Estorno')])]);
    expect(situacaoDoBancoNoPeriodo(e, 'b', 'b', M).tipo).toBe('pendente');
  });
  it('sem dia negativo: Ok direto', () => {
    const e = emp([arq('e', 'banco', EXTRATO, 20000), arq('r', 'sistema', RAZAO)]);
    expect(situacaoDoBancoNoPeriodo(e, 'b', 'b', M)).toEqual({ tipo: 'ok', negativos: [] });
  });
});

describe('o cheque especial da virada do ano (até 5 de janeiro)', () => {
  it('reconhece o lançamento do cheque especial de 1º a 5 de janeiro', () => {
    expect(chequeDaViradaDoAno({ data: '2026-01-02', historico: 'Cheque Especial - Banco do Brasil' })).toBe(true);
    expect(chequeDaViradaDoAno({ data: '2026-01-05', historico: '92029 ESTORNO' })).toBe(true);
    expect(chequeDaViradaDoAno({ data: '2026-01-06', historico: 'Cheque Especial - Banco do Brasil' })).toBe(false);
    expect(chequeDaViradaDoAno({ data: '2026-02-02', historico: 'Cheque Especial' })).toBe(false);
    expect(chequeDaViradaDoAno({ data: '2026-01-02', historico: 'Pagamento' })).toBe(false);
  });
  it('no razão de janeiro, sem par no extrato: não fica pendente', () => {
    const e = emp([
      arq('ext', 'banco', [L('2026-01-03', 5000, 'PIX RECEBIDO')], 10000),
      arq('raz', 'sistema', [L('2026-01-03', 5000, 'Recebimento'), L('2026-01-02', 2428, 'Cheque Especial - Banco do Brasil')]),
    ]);
    expect(situacaoDoBancoNoPeriodo(e, 'banco', 'banco', ['2026-01']).tipo).toBe('ok');
  });
});

describe('o estorno do cheque especial do dia anterior ao período (qualquer banco, qualquer mês)', () => {
  it('o extrato abre negativo e o razão traz o estorno nos 5 primeiros dias: certo, mesmo sem dizer "cheque especial"', () => {
    const e = emp([
      arq('ext', 'banco', [L('2026-03-03', 5000, 'PIX RECEBIDO')], -2428),
      arq('raz', 'sistema', [L('2026-03-03', 5000, 'Recebimento'), L('2026-03-02', -2428, 'Pela transferencia de saldo')]),
    ]);
    expect(situacaoDoBancoNoPeriodo(e, 'banco', 'banco', ['2026-03']).tipo).toBe('ok');
  });
  it('depois do dia 5, ou com outro valor: pendente', () => {
    const tarde = emp([
      arq('ext', 'banco', [L('2026-03-03', 5000, 'PIX RECEBIDO')], -2428),
      arq('raz', 'sistema', [L('2026-03-03', 5000, 'Recebimento'), L('2026-03-09', -2428, 'Pela transferencia de saldo')]),
    ]);
    expect(situacaoDoBancoNoPeriodo(tarde, 'banco', 'banco', ['2026-03']).tipo).toBe('pendente');
    const outro = emp([
      arq('ext', 'banco', [L('2026-03-03', 5000, 'PIX RECEBIDO')], -2428),
      arq('raz', 'sistema', [L('2026-03-03', 5000, 'Recebimento'), L('2026-03-02', -1000, 'Pela transferencia de saldo')]),
    ]);
    expect(situacaoDoBancoNoPeriodo(outro, 'banco', 'banco', ['2026-03']).tipo).toBe('pendente');
  });
});
