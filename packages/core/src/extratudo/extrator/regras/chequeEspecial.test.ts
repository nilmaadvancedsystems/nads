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
  it('sai mesmo com outra pendência entre o extrato e o razão (16/11/2026)', () => {
    // a tarifa de 03/03 lida no extrato num dia e no razão no outro: pendência, mas o dia negativo continua faltando
    const comPendencia: EmpresaExtrator = { ...e, arquivos: [
      arq('e', 'banco', [L('2026-03-03', -15000, 'PIX ENVIADO'), L('2026-03-04', 8000, 'PIX RECEBIDO'), L('2026-03-05', -500, 'TARIFA')], 10000),
      arq('r', 'sistema', [L('2026-03-03', -15000, 'Pagamento'), L('2026-03-04', 8000, 'Recebimento'), L('2026-03-06', -500, 'Tarifa')]),
    ] };
    const ch = chequeEspecialDoBanco(comPendencia, 'b', 'b', M);
    expect(ch.faltam).toEqual([{ data: '2026-03-03', saldo: -5000 }]);
    expect(ch.calcula).toBe(true);
    expect(ch.pendencias).toBeGreaterThan(0);
  });
  it('fica de fora o banco que nunca fecha negativo e o que já está com o cheque no razão (16/11/2026)', () => {
    const positivo: EmpresaExtrator = { ...e, arquivos: [
      arq('e', 'banco', [L('2026-03-03', -5000, 'PIX ENVIADO')], 10000), arq('r', 'sistema', [L('2026-03-03', -5000, 'Pagamento')]),
    ] };
    expect(chequeEspecialDoBanco(positivo, 'b', 'b', M)).toMatchObject({ negativos: [], calcula: false });
    const feito: EmpresaExtrator = { ...e, arquivos: [...e.arquivos.filter(a => a.lado === 'banco'),
      arq('r', 'sistema', [L('2026-03-03', -15000, 'Pagamento'), L('2026-03-03', 5000, 'Cheque especial 92029'), L('2026-03-04', -5000, 'Cheque especial 92029'), L('2026-03-04', 8000, 'Recebimento')])] };
    expect(chequeEspecialDoBanco(feito, 'b', 'b', M)).toMatchObject({ faltam: [], calcula: false });
  });
  it('sem o razão do mês, os dias negativos saem todos do extrato (16/11/2026: "Tem bancos no cheque especial")', () => {
    const soExtrato: EmpresaExtrator = { ...e, arquivos: e.arquivos.filter(a => a.lado === 'banco') };
    expect(chequeEspecialDoBanco(soExtrato, 'b', 'b', M)).toMatchObject({ faltam: [{ data: '2026-03-03', saldo: -5000 }], calcula: true, semRazao: ['2026-03'] });
    // um mês com o razão (o cheque já feito) e outro sem: só o sem razão entra inteiro
    const doisMeses: EmpresaExtrator = { ...e, arquivos: [
      arq('e', 'banco', [L('2026-03-03', -15000, 'PIX ENVIADO'), L('2026-03-04', 8000, 'PIX RECEBIDO'), L('2026-04-02', -4000, 'PIX ENVIADO'), L('2026-04-03', 9000, 'PIX RECEBIDO')], 10000),
      arq('r', 'sistema', [L('2026-03-03', -15000, 'Pagamento'), L('2026-03-03', 5000, 'Cheque especial 92029'), L('2026-03-04', -5000, 'Cheque especial 92029'), L('2026-03-04', 8000, 'Recebimento')]),
    ] };
    const ch = chequeEspecialDoBanco(doisMeses, 'b', 'b', ['2026-03', '2026-04']);
    expect(ch.faltam).toEqual([{ data: '2026-04-02', saldo: -1000 }]);
    expect(ch.semRazao).toEqual(['2026-04']);
    // com o razão de todos os meses, nada muda
    expect(chequeEspecialDoBanco(e, 'b', 'b', M).semRazao).toEqual([]);
  });
  it('o ajuste no dia (D banco / C cheque) e o estorno no dia seguinte do extrato, histórico 92029', () => {
    const lanc = lancamentosDoChequeEspecial(e, 'b', 'b', M, chequeEspecialDoBanco(e, 'b', 'b', M).faltam, '10506', '90503');
    expect(lanc.map(l => [l.tipo, l.data.getDate(), l.debito, l.credito, l.valor, l.historico])).toEqual([
      ['Ajuste', 3, '10506', '90503', 50, '92029'],
      ['Estorno', 4, '90503', '10506', 50, '92029'],
    ]);
  });
});
