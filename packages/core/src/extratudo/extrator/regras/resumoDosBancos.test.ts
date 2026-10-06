import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator } from '../tipos';
import { categoriaDoLancamento, resumoDosBancos } from './resumoDosBancos';

const arq = (id: string, lancamentos: [string, number, string][], saldoAnterior?: number): ArquivoImportado => ({
  id, lado: 'banco', nome: id, importadoEm: '2026-09-29T12:00:00Z', modo: 'primeira', banco: 'sicoob',
  ...(saldoAnterior != null ? { saldoAnterior } : {}),
  lancamentos: lancamentos.map(([data, valor, historico]) => ({ data, valor, historico })),
});
const emp = (arquivos: ArquivoImportado[]): EmpresaExtrator => ({ nome: 'FITO', arquivos, auditoria: [] });

describe('relatório dos bancos (a etapa Bancos da Tarefa)', () => {
  it('cada lançamento numa categoria pelo histórico (e o sócio pelo nome do Cadastro)', () => {
    expect(categoriaDoLancamento('CRÉD.LIQ.COBRANÇA', 100)).toBe('credliq');
    expect(categoriaDoLancamento('TARIFA COBRANÇA DOC.: 2316852', -510)).toBe('despesas');
    expect(categoriaDoLancamento('PAGAMENTO DE BOLETO - FORNECEDOR X', -1000)).toBe('boletos');
    expect(categoriaDoLancamento('DÉB.CONV. CEMIG DISTRIBUICAO', -1000)).toBe('luz');
    expect(categoriaDoLancamento('DÉB.CONV. COPASA', -1000)).toBe('agua');
    expect(categoriaDoLancamento('PIX EMIT.OUTRA IF Pagamento Pix MARCOS ANTONIO SILVA', -5000, [{ nome: 'Marcos Antonio da Silva' }])).toBe('socio');
    // pelo CPF mascarado do PIX (os 6 dígitos do meio)
    expect(categoriaDoLancamento('PIX EMIT.OUTRA IF Pagamento Pix ***.405.586-** retirada', -5000, [{ nome: 'Marcos', cpf: '12340558690' }])).toBe('socio');
    expect(categoriaDoLancamento('PIX EMIT.OUTRA IF Pagamento Pix ***.999.586-** bananas', -5000, [{ nome: 'Marcos', cpf: '12340558690' }])).toBe('outras-saidas');
    expect(categoriaDoLancamento('PIX EMIT.OUTRA IF Pagamento Pix ***.405.586-** distribuicao de lucro', -4950000)).toBe('socio');
    expect(categoriaDoLancamento('PIX EMIT.OUTRA IF Pagamento Pix bananas', -544000)).toBe('outras-saidas');
    expect(categoriaDoLancamento('PIX RECEB.OUTRA IF', 2000)).toBe('outras-entradas');
  });
  it('os saldos do período, mês a mês, e as categorias da maior para a menor', () => {
    const e = emp([
      arq('jul', [['2026-07-03', 100000, 'CRÉD.LIQ.COBRANÇA'], ['2026-07-04', -510, 'TARIFA']], 10000),
      arq('ago', [['2026-08-03', 50000, 'CRÉD.LIQ.COBRANÇA'], ['2026-08-05', -20000, 'PAGAMENTO DE BOLETO'], ['2026-08-06', -1000, 'TARIFA']]),
    ]);
    const [b] = resumoDosBancos(e, [{ id: 'sicoob', nome: 'Sicoob' }], 'sicoob', ['2026-08', '2026-07']);
    expect([b.saldoInicial, b.saldoFinal, b.entradas, b.saidas, b.temExtrato]).toEqual([10000, 138490, 150000, 21510, true]);
    expect(b.meses.map(m => [m.mes, m.entradas, m.saidas, m.saldoFinal])).toEqual([['2026-07', 100000, 510, 109490], ['2026-08', 50000, 21000, 138490]]);
    expect(b.categorias.map(c => [c.id, c.total, c.qtd])).toEqual([['credliq', 150000, 2], ['boletos', 20000, 1], ['despesas', 1510, 2]]);
    expect(b.categorias[2].lancamentos.map(l => [l.data, l.valor])).toEqual([['2026-07-04', -510], ['2026-08-06', -1000]]);
  });
});
