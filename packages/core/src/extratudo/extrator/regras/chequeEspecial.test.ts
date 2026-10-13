import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, Lancamento } from '../tipos';
import { chequeEspecialDoBanco, lancamentosDoChequeEspecial } from './chequeEspecial';

const arq = (id: string, lado: 'banco' | 'sistema', lancamentos: Lancamento[], saldoAnterior?: number): ArquivoImportado =>
  ({ id, lado, nome: id, importadoEm: '2026-10-01T12:00:00Z', modo: 'primeira', lancamentos, ...(saldoAnterior != null ? { saldoAnterior } : {}) });
const L = (data: string, valor: number, historico: string): Lancamento => ({ data, valor, historico });
const M = ['2026-03'];

describe('o cheque especial do banco, direto do extrato (Vitor, 13/10/2026)', () => {
  // saldo anterior 100,00; 03/03 sai 150,00 (fecha −50,00); 04/03 entra 80,00 (fecha 30,00)
  const e: EmpresaExtrator = { nome: 'X', auditoria: [], arquivos: [
    arq('e', 'banco', [L('2026-03-03', -15000, 'PIX ENVIADO'), L('2026-03-04', 8000, 'PIX RECEBIDO')], 10000),
    arq('r', 'sistema', [L('2026-03-03', -15000, 'Pagamento'), L('2026-03-04', 8000, 'Recebimento')]),
  ] };
  it('o dia negativo sem o cheque no razão', () => {
    expect(chequeEspecialDoBanco(e, 'b', 'b', M).faltam).toEqual([{ data: '2026-03-03', saldo: -5000 }]);
  });
  it('o ajuste no dia (D banco / C cheque) e o estorno no dia seguinte do extrato, histórico 92029', () => {
    const lanc = lancamentosDoChequeEspecial(e, 'b', 'b', M, chequeEspecialDoBanco(e, 'b', 'b', M).faltam, '10506', '90503');
    expect(lanc.map(l => [l.tipo, l.data.getDate(), l.debito, l.credito, l.valor, l.historico])).toEqual([
      ['Ajuste', 3, '10506', '90503', 50, '92029'],
      ['Estorno', 4, '90503', '10506', 50, '92029'],
    ]);
  });
});
