import { describe, expect, it } from 'vitest';
import type { ItemDrive } from '../../creditor/regras/drive';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { acharExtratoNoDrive } from './drive';
import { movimentoDoExtrato } from './movimento';

const arq = (id: string, lancamentos: [string, number][], banco?: string, lado: 'banco' | 'sistema' = 'banco'): ArquivoImportado => ({
  id, lado, nome: id, importadoEm: '2026-09-29T12:00:00Z', modo: 'primeira', ...(banco ? { banco } : {}),
  lancamentos: lancamentos.map(([data, valor]) => ({ data, valor, historico: 'H ' + data })),
});
const emp = (arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'FITO', arquivos, auditoria: [] });

describe('movimento do extrato (a setinha da linha do banco)', () => {
  it('saldo acumula os meses anteriores importados; só a competência nas linhas', () => {
    const e = emp([
      arq('jul', [['2026-07-10', 10000], ['2026-07-20', -2500]]),
      arq('ago', [['2026-08-05', -1000], ['2026-08-02', 3000]]),
      arq('set', [['2026-09-01', 99999]]),
      arq('itau', [['2026-08-03', 777]], 'itau'),
      arq('razao', [['2026-08-03', 5]], undefined, 'sistema'),
    ]);
    const m = movimentoDoExtrato(e, 'sicoob', 'sicoob', '2026-08');
    expect(m.saldoAnterior).toBe(7500);
    expect(m.linhas.map(l => [l.data, l.valor, l.saldo])).toEqual([['2026-08-02', 3000, 10500], ['2026-08-05', -1000, 9500]]);
    expect([m.entradas, m.saidas]).toEqual([3000, -1000]);
    expect(movimentoDoExtrato(e, 'itau', 'sicoob', '2026-08').linhas.map(l => l.saldo)).toEqual([777]);
  });
});

describe('extrato no Drive', () => {
  const it_ = (i: string, n: string, p: string, t: 'd' | 'f' = 'f', m?: string): ItemDrive => ({ i, n, p, t, ...(m ? { m } : {}) });
  const itens = [
    it_('c', 'CONTÁBIL', 'raiz', 'd'), it_('e', 'EXTRATOS', 'c', 'd'),
    it_('1', 'EXTRATO SICOOB 08-2026.pdf', 'e'), it_('2', 'EXTRATO SICOOB 07-2026.pdf', 'e'),
    it_('3', 'CREDLIQUIDAÇÃO 08-2026.pdf', 'c'), it_('4', 'EXTRATO ITAU 08-2026.pdf', 'e'),
  ];
  it('acha o da competência e do banco; ignora relatório de liquidação', () => {
    const b = acharExtratoNoDrive(itens, 'raiz', '2026-08', { nome: 'Sicoob', marca: 'sicoob' });
    expect(b.situacao).toBe('achou');
    expect(b.arquivo?.id).toBe('1');
    expect(b.candidatos.map(c => c.id)).not.toContain('3');
  });
  it('sem banco no nome: vários, a pessoa escolhe; sem pasta: sem-cliente', () => {
    expect(acharExtratoNoDrive(itens, 'raiz', '2026-08', { nome: 'Banco', marca: 'banco' }).situacao).toBe('varios');
    expect(acharExtratoNoDrive(itens, null, '2026-08', { nome: 'Sicoob' }).situacao).toBe('sem-cliente');
  });
});
