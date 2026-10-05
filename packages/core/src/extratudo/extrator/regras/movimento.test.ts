import { describe, expect, it } from 'vitest';
import type { ItemDrive } from '../../creditor/regras/drive';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { acharExtratoNoDrive } from './drive';
import { definirSaldoAnterior, extratosSemSaldoAnterior, movimentoDoExtrato, TODOS_OS_MESES } from './movimento';

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
  it('o primeiro extrato do Drive sem o saldo anterior: completa e fica no histórico', () => {
    const jan = { ...arq('jan', [['2026-01-02', 4500]]), drive: { id: 'd1', nome: '01-2026.pdf' } };
    const fev = { ...arq('fev', [['2026-02-03', -500]]), drive: { id: 'd2', nome: '02-2026.pdf' } };
    const itau = arq('itau', [['2026-01-05', 10]], 'itau');
    const e = emp([fev, jan, itau]);
    expect(extratosSemSaldoAnterior(e, 'sicoob').map(a => a.id)).toEqual(['jan']);
    const e2 = definirSaldoAnterior(e, 'jan', 1000000, new Date('2026-10-01T12:00:00Z'));
    expect(movimentoDoExtrato(e2, 'sicoob', 'sicoob', '2026-01').abertura).toBe(1000000);
    expect(e2.auditoria[0]).toMatchObject({ acao: 'Leu o saldo anterior' });
    expect(extratosSemSaldoAnterior(e2, 'sicoob')).toEqual([]);
  });
  it('o saldo anterior do primeiro extrato abre a conta (sem mês antes no sistema)', () => {
    const jan = { ...arq('jan', [['2026-01-02', 4500]]), saldoAnterior: 1000000 };
    const e = emp([jan, arq('fev', [['2026-02-03', -500]])]);
    const m1 = movimentoDoExtrato(e, 'sicoob', 'sicoob', '2026-01');
    expect([m1.abertura, m1.saldoAnterior, m1.linhas[0].saldo]).toEqual([1000000, 1000000, 1004500]);
    expect(m1.mesesAntes).toBe(false);
    expect(movimentoDoExtrato(e, 'sicoob', 'sicoob', '2026-02').mesesAntes).toBe(true);
    expect(movimentoDoExtrato(e, 'sicoob', 'sicoob', '2026-02').saldoAnterior).toBe(1004500);
    expect(movimentoDoExtrato(emp([arq('x', [['2026-01-02', 10]])]), 'sicoob', 'sicoob', '2026-01').abertura).toBeNull();
  });
  it('"Todos": todos os extratos importados da conta, do primeiro ao último mês', () => {
    const e = emp([arq('jul', [['2026-07-10', 10000]]), arq('ago', [['2026-08-02', -3000]]), arq('itau', [['2026-08-03', 777]], 'itau')]);
    const m = movimentoDoExtrato(e, 'sicoob', 'sicoob', TODOS_OS_MESES.de, TODOS_OS_MESES.ate);
    expect(m.saldoAnterior).toBe(0);
    expect(m.linhas.map(l => [l.data, l.saldo])).toEqual([['2026-07-10', 10000], ['2026-08-02', 7000]]);
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

describe('extrato no Drive: pasta de cada banco (empresa 58, BNB e Sicoob)', () => {
  const d = (i: string, n: string, p: string) => ({ i, n, p, t: 'd' as const });
  const f = (i: string, n: string, p: string) => ({ i, n, p, t: 'f' as const });
  const itens = [
    d('c', 'CONTÁBIL', 'raiz'), d('e', 'EXTRATOS', 'c'), d('a', '2026', 'e'),
    ...['05', '06', '07', '08', '09'].flatMap(m => [d('m' + m, m, 'a'), d('b' + m, 'BANCÁRIOS', 'm' + m), d('bnb' + m, 'BNB', 'b' + m), d('sic' + m, 'SICOOB', 'b' + m),
      f('fb' + m, m + '-2026.pdf', 'bnb' + m), f('fs' + m, m + '-2026.pdf', 'sic' + m)]),
  ];
  it('Sicoob: acha o do Sicoob do mês, sem perguntar', () => {
    const b = acharExtratoNoDrive(itens, 'raiz', '2026-08', { nome: 'Sicoob', marca: 'sicoob' });
    expect(b.situacao).toBe('achou');
    expect(b.arquivo?.id).toBe('fs08');
  });
  it('Banco do Nordeste: acha pela pasta BNB', () => {
    expect(acharExtratoNoDrive(itens, 'raiz', '2026-08', { nome: 'Banco do Nordeste', marca: 'bnb' }).arquivo?.id).toBe('fb08');
  });
  it('banco sem nome: pergunta, mas só entre os do mês', () => {
    const b = acharExtratoNoDrive(itens, 'raiz', '2026-08', { nome: 'Banco', marca: 'banco' });
    expect(b.situacao).toBe('varios');
    expect(b.candidatos.map(c => c.id).sort()).toEqual(['fb08', 'fs08']);
  });
});

describe('extrato no Drive: comprovantes da mesma competência não atrapalham', () => {
  it('acha o extrato em BANCÁRIOS mesmo com vários comprovantes do mês em COMPROVANTES', () => {
    const d = (i: string, n: string, p: string) => ({ i, n, p, t: 'd' as const });
    const f = (i: string, n: string, p: string) => ({ i, n, p, t: 'f' as const });
    const itens = [
      d('c', 'CONTÁBIL', 'raiz'), d('e', 'EXTRATOS', 'c'), d('a', '2026', 'e'), d('m', '03', 'a'),
      d('b', 'BANCÁRIOS', 'm'), d('bs', 'SICOOB', 'b'), f('x', '03-2026.pdf', 'bs'),
      d('cp', 'COMPROVANTES', 'm'), d('cs', 'SICOOB', 'cp'),
      f('c1', 'Comprovante 26-03-2026 15h05m34s.pdf', 'cs'), f('c2', 'Comprovante 26-03-2026 15h05m35s.pdf', 'cs'),
    ];
    const r = acharExtratoNoDrive(itens, 'raiz', '2026-03', { nome: 'Sicoob', marca: 'sicoob' });
    expect(r.situacao).toBe('achou');
    expect(r.arquivo?.id).toBe('x');
  });
});
