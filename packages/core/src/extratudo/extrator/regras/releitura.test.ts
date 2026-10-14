import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { extratosParaReler, relerExtrato, VERSAO_DO_LEITOR } from './importacao';

describe('reler o extrato do Drive com o leitor novo (Vitor, 14/10/2026)', () => {
  const velho: ArquivoImportado = { id: 'a', lado: 'banco', nome: '08-2026.pdf', importadoEm: '2026-10-13T00:00:00Z', modo: 'primeira', banco: 'bnb', drive: { id: 'x', nome: '08-2026.pdf' },
    lancamentos: [{ data: '2026-08-10', valor: 165000, historico: 'SELETA' }, { data: '2026-08-10', valor: 3907, historico: 'BNB AUTOMATICO FIF (*)' }] };
  const e: EmpresaExtrator = { nome: 'X', auditoria: [], arquivos: [velho, { ...velho, id: 'b', drive: undefined, nome: 'do-pc.pdf' }] };
  it('só os do Drive com leitor mais velho', () => {
    expect(extratosParaReler(e).map(a => a.id)).toEqual(['a']);
  });
  it('troca os lançamentos, marca a versão e fica no histórico', () => {
    const r = relerExtrato(e, 'a', { nome: '08-2026.pdf', erro: null, lancamentos: [{ data: '2026-08-10', valor: 165000, historico: 'RECEBIMENTO VIA PIX SELETA' }], saldoAnterior: 0 }, new Date('2026-10-14T12:00:00Z'));
    const a = r.arquivos.find(x => x.id === 'a')!;
    expect(a.lancamentos.map(l => l.historico)).toEqual(['RECEBIMENTO VIA PIX SELETA']);
    expect([a.leitor, a.saldoAnterior, a.drive?.id]).toEqual([VERSAO_DO_LEITOR, 0, 'x']);
    expect(r.auditoria[0].acao).toBe('Releu o extrato');
    expect(extratosParaReler(r)).toEqual([]);
  });
});
