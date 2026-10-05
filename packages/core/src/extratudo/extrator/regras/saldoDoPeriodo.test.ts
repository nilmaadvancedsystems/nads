import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { partesForaDoRazao, saldoDoPeriodo } from './saldoDoPeriodo';

const arq = (id: string, lancamentos: [string, number][], lado: 'banco' | 'sistema' = 'banco', saldoAnterior?: number): ArquivoImportado => ({
  id, lado, nome: id, importadoEm: '2026-09-29T12:00:00Z', modo: 'primeira', banco: 'sicoob',
  ...(saldoAnterior != null ? { saldoAnterior } : {}),
  lancamentos: lancamentos.map(([data, valor]) => ({ data, valor, historico: 'H ' + data })),
});
const emp = (arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'FITO', arquivos, auditoria: [] });

describe('saldo do banco no período (a etapa Exclusão do Creditor)', () => {
  const extrato = arq('ext', [['2026-08-03', 100000], ['2026-08-03', 50000], ['2026-08-10', -20000]], 'banco', 10000);
  it('o razão com o total quebrado em partes (o .xls do Creditor) bate dia a dia e no fim', () => {
    const razao = arq('raz', [['2026-08-03', 60000], ['2026-08-03', 40000], ['2026-08-03', 50000], ['2026-08-10', -20000]], 'sistema');
    const s = saldoDoPeriodo(emp([extrato, razao]), 'sicoob', 'sicoob', ['2026-08']);
    expect([s.completo, s.extrato, s.razao, s.bate, s.dias]).toEqual([true, 140000, 140000, true, []]);
  });
  it('o total esquecido no razão (não excluído): o dia e o fim não batem', () => {
    const razao = arq('raz', [['2026-08-03', 100000], ['2026-08-03', 60000], ['2026-08-03', 40000], ['2026-08-03', 50000], ['2026-08-10', -20000]], 'sistema');
    const s = saldoDoPeriodo(emp([extrato, razao]), 'sicoob', 'sicoob', ['2026-08']);
    expect([s.bate, s.razao - s.extrato]).toEqual([false, 100000]);
    expect(s.dias.map(d => [d.data, d.diferenca])).toEqual([['2026-08-03', 100000], ['2026-08-10', 100000]]);
  });
  it('o razão com o sinal ao contrário (débito/crédito) vira; sem razão, não está completo', () => {
    const invertido = arq('raz', [['2026-08-03', -100000], ['2026-08-03', -50000], ['2026-08-10', 20000], ['2026-08-11', 0]], 'sistema');
    expect(saldoDoPeriodo(emp([extrato, invertido]), 'sicoob', 'sicoob', ['2026-08']).bate).toBe(true);
    expect(saldoDoPeriodo(emp([extrato]), 'sicoob', 'sicoob', ['2026-08']).completo).toBe(false);
  });
  it('as partes do .xls do Creditor no razão: com o total ainda lá, faltam; trocado, nenhuma falta', () => {
    const partes = [{ data: '2026-08-03', valor: 60000, historico: 'NF 1' }, { data: '2026-08-03', valor: 40000, historico: 'NF 2' }];
    const comTotal = arq('raz', [['2026-08-03', 100000], ['2026-08-03', 50000], ['2026-08-10', -20000]], 'sistema');
    expect(partesForaDoRazao(emp([extrato, comTotal]), 'sicoob', 'sicoob', ['2026-08'], partes).map(p => p.historico)).toEqual(['NF 1', 'NF 2']);
    const trocado = arq('raz', [['2026-08-03', -60000], ['2026-08-03', -40000], ['2026-08-03', 50000]], 'sistema');
    expect(partesForaDoRazao(emp([extrato, trocado]), 'sicoob', 'sicoob', ['2026-08'], partes)).toEqual([]);
  });
});
