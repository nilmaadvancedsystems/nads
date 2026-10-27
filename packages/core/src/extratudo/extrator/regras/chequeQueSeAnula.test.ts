import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { conferenciaDoBanco } from './situacaoDoBanco';

const l = (data: string, valor: number, historico: string, complemento?: string): Lancamento => ({ data, valor, historico, ...(complemento ? { complemento } : {}) });
const arq = (id: string, lado: 'banco' | 'sistema', lancamentos: Lancamento[], extra: Partial<ArquivoImportado> = {}): ArquivoImportado =>
  ({ id, lado, nome: id, importadoEm: '2026-10-27', modo: 'primeira', banco: 'bb', lancamentos, ...extra });
// o extrato: 30/03 fecha negativo em 134,61; o razão tem o cheque especial desse dia e outro par (257,16) que se anula
const EXTRATO = [l('2026-03-27', 10000, 'Pix recebido'), l('2026-03-30', -23461, 'Pix enviado'), l('2026-03-31', 23461, 'Pix recebido')];
const empresa = (razao: Lancamento[]): EmpresaExtrator => ({ nome: 'T', auditoria: [], arquivos: [arq('e', 'banco', EXTRATO, { saldoAnterior: 0 }), arq('r', 'sistema', [...EXTRATO, ...razao])] });
const CHEQUE = 'Cheque Especial - Banco do Brasil';

describe('o par de cheque especial que se anula no razão (Vitor, 27/10/2026: a 237 — "já foi feito o cheque especial")', () => {
  it('o ajuste e o estorno do mesmo valor, sem dia negativo desse valor, não são pendência', () => {
    const c = conferenciaDoBanco(empresa([
      l('2026-03-30', 13461, CHEQUE), l('2026-03-31', -13461, CHEQUE),
      l('2026-03-30', 25716, CHEQUE, 'Pela transferencia de saldo'), l('2026-03-31', -25716, CHEQUE, 'Pela transferencia de saldo'),
    ]), 'bb', 'bb', ['2026-03']);
    expect(c.faltamCheque).toEqual([]);
    expect(c.pendencias).toEqual([]);
  });
  it('o cheque especial sem o par continua pendência', () => {
    const c = conferenciaDoBanco(empresa([l('2026-03-30', 13461, CHEQUE), l('2026-03-31', -13461, CHEQUE), l('2026-03-30', 25716, CHEQUE)]), 'bb', 'bb', ['2026-03']);
    expect(c.pendencias.flatMap(p => p.linhas).map(x => x.sistema?.valor)).toEqual([25716]);
  });
});
